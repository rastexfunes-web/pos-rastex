/**
 * functions/index.js — Cloud Function que pide el CAE a ARCA para una
 * venta de Rastex Gestión.
 *
 * Usa la librería "afip.js" (@afipsdk/afip.js), que encapsula WSAA
 * (autenticación) y WSFEv1 (facturación electrónica). Usa un access_token
 * de https://app.afipsdk.com (gratis, plan Free) junto con nuestro propio
 * certificado.
 *
 * DATOS DE ESTA CUENTA:
 *   CUIT: 20291101519 (Marcelo Silva, Responsable Inscripto)
 *   Punto de venta: 10
 *   Ambiente: Homologación (pruebas) — cuando esté todo probado, se pasa
 *   a producción.
 *
 * Por defecto factura a Consumidor Final (Factura B). Si se pasa
 * tipoCliente: "responsable_inscripto" junto con cuitCliente, factura
 * Factura A a ese CUIT. En ambos casos se discrimina IVA al 21%, porque
 * los precios cargados en Stock ya lo incluyen.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Afip = require("@afipsdk/afip.js");

// Arregla un problema conocido de conexión SSL/TLS entre Node 20 y los
// servidores de homologación de ARCA (usan una clave Diffie-Hellman vieja
// que Node rechaza por defecto).
const tls = require("tls");
tls.DEFAULT_MIN_DH_SIZE = 1024;

if (!admin.apps.length) admin.initializeApp();

const CUIT = 20291101519;
const PUNTO_VENTA = 10;
const ALICUOTA_IVA = 0.21;
const ID_ALICUOTA_21 = 5; // Id de ARCA para IVA 21%

const DATOS_EMISOR = {
  business_name: "Marcelo Fernando Silva",
  address: "Calle 4D 4603, Funes, Santa Fe",
  iva_condition: "Responsable Inscripto",
  gross_income: "0213281643",
  activity_start_date: "01/04/2004",
};

function crearClienteAfip() {
  return new Afip({
    CUIT,
    cert: process.env.ARCA_CERT,
    key: process.env.ARCA_KEY,
    access_token: process.env.ARCA_ACCESS_TOKEN,
    production: false, // AJUSTAR a true cuando pasemos a producción
  });
}

exports.facturarVenta = functions
  .runWith({ secrets: ["ARCA_CERT", "ARCA_KEY", "ARCA_ACCESS_TOKEN"] })
  .https.onCall(async (data, context) => {
    const { total, tipoCliente, cuitCliente } = data;

    if (!total || total <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "El total de la venta tiene que ser mayor a 0.");
    }

    const esRI = tipoCliente === "responsable_inscripto";

    const CbteTipo = esRI ? 1 : 6; // 1 = Factura A, 6 = Factura B
    const DocTipo = esRI ? 80 : 99; // 80 = CUIT, 99 = Consumidor Final sin identificar
    const CondicionIVAReceptorId = esRI ? 1 : 5; // 1 = Responsable Inscripto, 5 = Consumidor Final

    let DocNro = 0;
    if (esRI) {
      DocNro = Number(String(cuitCliente || "").replace(/\D/g, ""));
      if (!DocNro || DocNro <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Para Factura A necesitamos el CUIT del cliente.");
      }
    }

    const afip = crearClienteAfip();

    try {
      const ultimoNro = await afip.ElectronicBilling.getLastVoucher(PUNTO_VENTA, CbteTipo);
      const nuevoNro = ultimoNro + 1;

      const hoy = new Date();
      const fechaCbte = hoy.toISOString().slice(0, 10).replace(/-/g, "");

      const totalRedondeado = Math.round(total * 100) / 100;
      const impNeto = Math.round((totalRedondeado / (1 + ALICUOTA_IVA)) * 100) / 100;
      const impIVA = Math.round((totalRedondeado - impNeto) * 100) / 100;

      const comprobante = {
        CantReg: 1,
        PtoVta: PUNTO_VENTA,
        CbteTipo,
        Concepto: 1,
        DocTipo,
        DocNro,
        CondicionIVAReceptorId,
        CbteDesde: nuevoNro,
        CbteHasta: nuevoNro,
        CbteFch: fechaCbte,
        ImpTotal: totalRedondeado,
        ImpTotConc: 0,
        ImpNeto: impNeto,
        ImpOpEx: 0,
        ImpIVA: impIVA,
        ImpTrib: 0,
        MonId: "PES",
        MonCotiz: 1,
        Iva: [{ Id: ID_ALICUOTA_21, BaseImp: impNeto, Importe: impIVA }],
      };

      const resultado = await afip.ElectronicBilling.createVoucher(comprobante);

      return {
        ok: true,
        cae: resultado.CAE,
        caeVencimiento: resultado.CAEFchVto,
        numeroComprobante: nuevoNro,
        puntoVenta: PUNTO_VENTA,
        tipoComprobante: CbteTipo,
        impNeto,
        impIVA,
      };
    } catch (err) {
      console.error("Error facturando en ARCA:", err);
      throw new functions.https.HttpsError("internal", "ARCA rechazó la factura: " + (err.message || String(err)));
    }
  });

/**
 * generarFacturaPDF — Genera el PDF oficial de una factura ya emitida
 * (con su CAE) usando los templates de AfipSDK, y devuelve una URL para
 * descargarlo. La URL dura 24hs, así que hay que descargarla o
 * compartirla enseguida.
 */
exports.generarFacturaPDF = functions
  .runWith({ secrets: ["ARCA_ACCESS_TOKEN"] })
  .https.onCall(async (data, context) => {
    const { items, total, impNeto, impIVA, tipoComprobante, puntoVenta, numeroComprobante, cae, caeVencimiento, tipoCliente, cuitCliente } = data;

    if (!cae) {
      throw new functions.https.HttpsError("invalid-argument", "Esta venta todavía no tiene CAE.");
    }

    const afip = new Afip({ access_token: process.env.ARCA_ACCESS_TOKEN });

    const esRI = tipoCliente === "responsable_inscripto";
    const templateName = tipoComprobante === 1 ? "invoice-a" : "invoice-b";

    function formatearFecha(fechaISO) {
      const d = new Date(fechaISO);
      return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    }

    function formatearFechaCAE(caeFchVto) {
      // viene como YYYYMMDD
      return caeFchVto.slice(6, 8) + "/" + caeFchVto.slice(4, 6) + "/" + caeFchVto.slice(0, 4);
    }

    try {
      const res = await afip.ElectronicBilling.createPDF({
        file_name: "factura-" + puntoVenta + "-" + numeroComprobante,
        template: {
          name: templateName,
          params: {
            voucher_number: numeroComprobante,
            sales_point: puntoVenta,
            issue_date: formatearFecha(new Date().toISOString()),
            cae_due_date: formatearFechaCAE(caeVencimiento),
            issuer_cuit: CUIT,
            cae: cae,
            issuer_business_name: DATOS_EMISOR.business_name,
            issuer_address: DATOS_EMISOR.address,
            issuer_iva_condition: DATOS_EMISOR.iva_condition,
            issuer_gross_income: DATOS_EMISOR.gross_income,
            issuer_activity_start_date: DATOS_EMISOR.activity_start_date,
            receiver_name: esRI ? "CUIT " + cuitCliente : "Consumidor Final",
            receiver_address: "-",
            receiver_document_type: esRI ? 80 : 99,
            receiver_document_number: esRI ? cuitCliente : 0,
            receiver_iva_condition: esRI ? "Responsable Inscripto" : "Consumidor Final",
            sale_condition: "Contado",
            currency_id: "ARS",
            currency_rate: 1,
            concept: 1,
            items: (items || []).map((i, idx) => ({
              code: String(idx + 1),
              description: i.nombre,
              quantity: i.cantidad,
              unit_price: i.precio,
              amount: Math.round(i.precio * i.cantidad * 100) / 100,
            })),
          },
        },
      });

      return { ok: true, url: res.file };
    } catch (err) {
      let detalle = err.message || String(err);
      if (err.data) {
        detalle = JSON.stringify(err.data, null, 2);
      } else if (err.response && err.response.data) {
        detalle = JSON.stringify(err.response.data, null, 2);
      }
      console.error("Error generando PDF (detalle):", detalle);
      throw new functions.https.HttpsError("internal", "No se pudo generar el PDF: " + detalle.slice(0, 1200));
    }
  });
