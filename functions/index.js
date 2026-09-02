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
 *   CUIT: 20291101519 (Marcelo Silva, monotributista)
 *   Punto de venta: 10
 *   Ambiente: Homologación (pruebas) — cuando esté todo probado, se pasa
 *   a producción.
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
const TIPO_COMPROBANTE = 11; // Factura C (monotributista, no discrimina IVA)

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
    const { total } = data;

    if (!total || total <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "El total de la venta tiene que ser mayor a 0.");
    }

    const afip = crearClienteAfip();

    try {
      const ultimoNro = await afip.ElectronicBilling.getLastVoucher(PUNTO_VENTA, TIPO_COMPROBANTE);
      const nuevoNro = ultimoNro + 1;

      const hoy = new Date();
      const fechaCbte = hoy.toISOString().slice(0, 10).replace(/-/g, "");
      const totalRedondeado = Math.round(total * 100) / 100;

      const comprobante = {
        CantReg: 1,
        PtoVta: PUNTO_VENTA,
        CbteTipo: TIPO_COMPROBANTE,
        Concepto: 1,
        DocTipo: 99,
        DocNro: 0,
        CbteDesde: nuevoNro,
        CbteHasta: nuevoNro,
        CbteFch: fechaCbte,
        ImpTotal: totalRedondeado,
        ImpTotConc: 0,
        ImpNeto: totalRedondeado,
        ImpOpEx: 0,
        ImpIVA: 0,
        ImpTrib: 0,
        MonId: "PES",
        MonCotiz: 1,
      };

      const resultado = await afip.ElectronicBilling.createVoucher(comprobante);

      return {
        ok: true,
        cae: resultado.CAE,
        caeVencimiento: resultado.CAEFchVto,
        numeroComprobante: nuevoNro,
        puntoVenta: PUNTO_VENTA,
        tipoComprobante: TIPO_COMPROBANTE,
      };
    } catch (err) {
      console.error("Error facturando en ARCA:", err);
      throw new functions.https.HttpsError("internal", "ARCA rechazó la factura: " + (err.message || String(err)));
    }
  });
