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
