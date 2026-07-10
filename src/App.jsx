import React, { useState, useEffect, useMemo } from "react";
import {
  Store, Package, BarChart3, Plus, Minus, Trash2, Banknote, CreditCard,
  ArrowLeftRight, ChevronDown, Pencil, X, Check, Wallet, QrCode, LogOut, Building2, Printer,
} from "lucide-react";
import { storage, loginConPin, logout } from "./firebase.js";

const NEGOCIOS = [
  { id: "colegio", nombre: "Colegio", color: "#3F6C51" },
  { id: "egresados", nombre: "JBC Egresados", color: "#8A3B2E" },
  { id: "clubes", nombre: "Clubes", color: "#2E4C6D" },
  { id: "dtf", nombre: "DTF", color: "#6B4C8A" },
  { id: "complejo", nombre: "Complejo", color: "#946B2D" },
];

const CATEGORIAS = [
  { id: "uniforme", label: "Uniformes", color: "#3F6C51" },
  { id: "libreria", label: "Librería", color: "#0E7C86" },
  { id: "fotocopia", label: "Fotocopias", color: "#6D6875" },
];

const FILTROS_PERIODO = [
  { id: "hoy", label: "Hoy" },
  { id: "dia", label: "Día" },
  { id: "30dias", label: "Últimos 30 días" },
  { id: "historico", label: "Histórico" },
];

const PAGOS = [
  { id: "efectivo", label: "Efectivo", icon: Banknote },
  { id: "transferencia", label: "Transferencia", icon: ArrowLeftRight },
  { id: "credito", label: "Crédito", icon: CreditCard },
  { id: "debito", label: "Débito", icon: Wallet },
  { id: "mercadopago", label: "Mercado Pago", icon: QrCode },
];

const UMBRAL_STOCK_BAJO = 5;

const TABS = [
  { id: "venta", label: "Vender", icon: Store },
  { id: "stock", label: "Stock", icon: Package },
  { id: "informes", label: "Informes", icon: BarChart3 },
];

const USUARIOS_POR_UID = {
  H2y2uvY7g0d4vpZgOH6MERC6mEI2: { nombre: "Marcelo", rol: "dueno" },
  QojAJ4SZlzPjPGe9N9BJmVwdAIt1: { nombre: "Luciana", rol: "empleado", negociosPermitidos: ["colegio"] },
};

function seedProductos(negocioId) {
  const base = {
    colegio: [
      {
        id: "u1",
        nombre: "Remera manga corta",
        sku: "UNI-001",
        categoria: "uniforme",
        talles: [
          { talle: "6", precio: 8500, stock: 12 },
          { talle: "8", precio: 8500, stock: 10 },
          { talle: "10", precio: 8500, stock: 8 },
          { talle: "14", precio: 10500, stock: 6 },
          { talle: "16", precio: 10500, stock: 4 },
        ],
      },
      {
        id: "u2",
        nombre: "Pantalón gris",
        sku: "UNI-002",
        categoria: "uniforme",
        talles: [
          { talle: "6", precio: 12000, stock: 10 },
          { talle: "10", precio: 12000, stock: 8 },
          { talle: "16", precio: 14500, stock: 7 },
        ],
      },
      { id: "l1", nombre: "Cuaderno A4 tapa dura", sku: "LIB-001", precio: 4500, stock: 60, categoria: "libreria" },
      { id: "l2", nombre: "Cartuchera completa", sku: "LIB-002", precio: 9800, stock: 30, categoria: "libreria" },
      { id: "f1", nombre: "Fotocopia simple", sku: "FOT-001", precio: 80, stock: 9999, categoria: "fotocopia" },
      { id: "f2", nombre: "Impresión color A4", sku: "FOT-002", precio: 350, stock: 9999, categoria: "fotocopia" },
    ],
    egresados: [
      { id: "e1", nombre: "Buzo Egresados 2026", sku: "EGR-001", precio: 22000, stock: 15 },
      { id: "e2", nombre: "Remera Egresados", sku: "EGR-002", precio: 14000, stock: 20 },
    ],
    clubes: [{ id: "c1", nombre: "Camiseta oficial", sku: "CLU-001", precio: 18000, stock: 10 }],
    dtf: [{ id: "d1", nombre: "Placa DTF A4", sku: "DTF-001", precio: 3500, stock: 100 }],
    complejo: [{ id: "co1", nombre: "Turno cancha", sku: "COM-001", precio: 15000, stock: 999 }],
  };
  return base[negocioId] || [];
}

function money(n) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function cajaCerradaDefault() {
  return { abierta: false, montoInicial: 0, horaApertura: null, cierres: [] };
}

function tieneTalles(p) {
  return Array.isArray(p.talles);
}

function stockTotal(p) {
  return tieneTalles(p) ? p.talles.reduce((acc, t) => acc + t.stock, 0) : p.stock;
}

function itemsStockBajo(productos) {
  const items = [];
  productos.forEach((p) => {
    if (tieneTalles(p)) {
      p.talles.forEach((t) => {
        if (t.stock < UMBRAL_STOCK_BAJO) {
          items.push({ nombre: p.nombre + " (talle " + t.talle + ")", sku: p.sku, categoria: p.categoria, stock: t.stock });
        }
      });
    } else if (p.stock < UMBRAL_STOCK_BAJO) {
      items.push({ nombre: p.nombre, sku: p.sku, categoria: p.categoria, stock: p.stock });
    }
  });
  return items.sort((a, b) => a.stock - b.stock);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function cargarNegocioData(id) {
  return storage
    .get("negocio:" + id)
    .then((res) => {
      if (res) {
        const parsed = JSON.parse(res.value);
        return {
          productos: parsed.productos || seedProductos(id),
          ventas: parsed.ventas || [],
          caja: parsed.caja || cajaCerradaDefault(),
        };
      }
      return { productos: seedProductos(id), ventas: [], caja: cajaCerradaDefault() };
    })
    .catch(() => ({ productos: seedProductos(id), ventas: [], caja: cajaCerradaDefault() }));
}

function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function intentarPin() {
    setCargando(true);
    setError("");
    const user = await loginConPin(pin);
    setCargando(false);
    if (!user) {
      setError("PIN incorrecto");
      return;
    }
    const datosUsuario = USUARIOS_POR_UID[user.uid];
    if (!datosUsuario) {
      setError("Este usuario no tiene un rol asignado. Avisale a Marcelo.");
      return;
    }
    onLogin(datosUsuario);
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">Rastex Gestión</h1>
        <p className="text-sm text-black/40 mb-6">Ingresá tu PIN para continuar</p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          placeholder="••••"
          className="w-full px-3 py-2 rounded-lg border border-black/15 text-center text-lg tracking-[0.5em] font-mono mb-2"
        />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button
          onClick={intentarPin}
          disabled={pin.length !== 4 || cargando}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-bold text-sm disabled:opacity-30 hover:brightness-110"
        >
          {cargando ? "Verificando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [negocioId, setNegocioId] = useState(NEGOCIOS[0].id);
  const [tab, setTab] = useState("venta");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [carrito, setCarrito] = useState([]);
  const [pagoSel, setPagoSel] = useState("efectivo");
  const [descuentoPct, setDescuentoPct] = useState("");
  const [pagoMultiple, setPagoMultiple] = useState(false);
  const [montosPago, setMontosPago] = useState({ efectivo: "", transferencia: "", credito: "", debito: "", mercadopago: "" });
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState({ nombre: "", sku: "", precio: "", stock: "", categoria: "uniforme" });
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: "", sku: "", precio: "", stock: "", categoria: "uniforme", talle: "" });
  const [errorForm, setErrorForm] = useState("");
  const [editandoTalle, setEditandoTalle] = useState(null);
  const [formTalle, setFormTalle] = useState({ precio: "", stock: "" });
  const [agregandoTalleEn, setAgregandoTalleEn] = useState(null);
  const [formNuevoTalle, setFormNuevoTalle] = useState({ talle: "", precio: "", stock: "" });
  const [errorTalle, setErrorTalle] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");
  const [talleElegido, setTalleElegido] = useState({});
  const [vistaTotales, setVistaTotales] = useState("hoy");
  const [fechaFiltro, setFechaFiltro] = useState(todayKey());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [verCuentaColegio, setVerCuentaColegio] = useState(false);
  const [verComision, setVerComision] = useState(false);
  const [verStockBajo, setVerStockBajo] = useState(false);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  const [montoApertura, setMontoApertura] = useState("");
  const [errorCaja, setErrorCaja] = useState("");
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [mostrarRetiro, setMostrarRetiro] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState("");
  const [motivoRetiro, setMotivoRetiro] = useState("");
  const [errorRetiro, setErrorRetiro] = useState("");

  const negocio = NEGOCIOS.find((n) => n.id === negocioId) || NEGOCIOS[0];

  const negociosVisibles =
    usuario && usuario.rol === "empleado" ? NEGOCIOS.filter((n) => usuario.negociosPermitidos.includes(n.id)) : NEGOCIOS;

  const tabsVisibles = usuario && usuario.rol === "empleado" ? TABS.filter((t) => t.id === "venta") : TABS;

  function iniciarSesion(u) {
    setUsuario(u);
    if (u.rol === "empleado" && u.negociosPermitidos && u.negociosPermitidos.length > 0) {
      setNegocioId(u.negociosPermitidos[0]);
      setTab("venta");
    }
  }

  function cerrarSesion() {
    logout();
    setUsuario(null);
    setMenuAbierto(false);
  }
  const storageKey = "negocio:" + negocioId;

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setCarrito([]);
    setDescuentoPct("");
    setPagoMultiple(false);
    setMontosPago({ efectivo: "", transferencia: "", credito: "", debito: "", mercadopago: "" });
    setMostrarCierre(false);
    setMontoApertura("");
    setErrorCaja("");
    setMostrarRetiro(false);
    setMontoRetiro("");
    setMotivoRetiro("");
    setErrorRetiro("");
    setCategoriaFiltro("todos");
    setTalleElegido({});
    setEditandoTalle(null);
    setFormTalle({ precio: "", stock: "" });
    setAgregandoTalleEn(null);
    setFormNuevoTalle({ talle: "", precio: "", stock: "" });
    setErrorTalle("");
    setVistaTotales("hoy");
    setFechaFiltro(todayKey());
    setFechaDesde("");
    setFechaHasta("");
    setVerCuentaColegio(false);
    setVerComision(false);
    setVerStockBajo(false);
    setConfirmarReinicio(false);
    cargarNegocioData(negocioId).then((val) => {
      if (cancelado) return;
      setData((prev) => ({ ...prev, [negocioId]: val }));
      if (!val.caja.abierta && val.caja.cierres.length > 0) {
        setMontoApertura(String(val.caja.cierres[0].efectivoFinal));
      }
      setLoading(false);
    });
    return () => {
      cancelado = true;
    };
  }, [negocioId]);

  const negocioData = data[negocioId] || { productos: [], ventas: [], caja: cajaCerradaDefault() };
  const caja = negocioData.caja || cajaCerradaDefault();
  const listaStockBajo = useMemo(() => itemsStockBajo(negocioData.productos), [negocioData.productos]);

  function persist(next) {
    setData((prev) => ({ ...prev, [negocioId]: next }));
    storage.set(storageKey, JSON.stringify(next)).then((res) => {
      if (!res) {
        console.error("No se pudo guardar en Firestore (storage.set devolvió null). Revisá la consola arriba por el error real.");
      } else {
        console.log("Guardado OK en Firestore:", storageKey);
      }
    });
  }

  function reiniciarVentas() {
    persist({ ...negocioData, ventas: [] });
    setConfirmarReinicio(false);
  }

  function agregarAlCarrito(producto, talle, precioUsado) {
    const cartId = producto.id + (talle ? "-" + talle : "");
    const nombreItem = producto.nombre + (talle ? " (talle " + talle + ")" : "");
    setCarrito((prev) => {
      const existe = prev.find((i) => i.cartId === cartId);
      if (existe) {
        return prev.map((i) => (i.cartId === cartId ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, { cartId, id: producto.id, talle: talle || null, nombre: nombreItem, precio: precioUsado, cantidad: 1 }];
    });
  }

  function cambiarCantidad(cartId, delta) {
    setCarrito((prev) =>
      prev.map((i) => (i.cartId === cartId ? { ...i, cantidad: i.cantidad + delta } : i)).filter((i) => i.cantidad > 0)
    );
  }

  function quitarDelCarrito(cartId) {
    setCarrito((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  const totalCarrito = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const descuentoNum = Math.min(100, Math.max(0, Number(descuentoPct) || 0));
  const montoDescuento = totalCarrito * (descuentoNum / 100);
  const totalConDescuento = totalCarrito - montoDescuento;

  const totalAsignadoMultiple = PAGOS.reduce((acc, p) => acc + (Number(montosPago[p.id]) || 0), 0);
  const diferenciaMultiple = Math.round((totalConDescuento - totalAsignadoMultiple) * 100) / 100;
  const pagoMultipleValido = pagoMultiple && Math.abs(diferenciaMultiple) < 1 && totalAsignadoMultiple > 0;

  function confirmarVenta(facturar, tipoPagoForzado) {
    if (carrito.length === 0) return;
    if (!tipoPagoForzado && pagoMultiple && !pagoMultipleValido) return;
    const nuevosProductos = negocioData.productos.map((p) => {
      if (tieneTalles(p)) {
        const nuevosTalles = p.talles.map((t) => {
          const cantidadVendida = carrito
            .filter((i) => i.id === p.id && i.talle === t.talle)
            .reduce((acc, i) => acc + i.cantidad, 0);
          return cantidadVendida > 0 ? { ...t, stock: Math.max(0, t.stock - cantidadVendida) } : t;
        });
        return { ...p, talles: nuevosTalles };
      }
      const cantidadVendida = carrito.filter((i) => i.id === p.id).reduce((acc, i) => acc + i.cantidad, 0);
      return cantidadVendida > 0 ? { ...p, stock: Math.max(0, p.stock - cantidadVendida) } : p;
    });
    const desglosePago =
      !tipoPagoForzado && pagoMultiple
        ? PAGOS.reduce((acc, p) => {
            const monto = Number(montosPago[p.id]) || 0;
            if (monto > 0) acc[p.id] = monto;
            return acc;
          }, {})
        : null;
    const venta = {
      id: "v-" + Date.now(),
      fecha: new Date().toISOString(),
      items: carrito,
      subtotal: totalCarrito,
      descuentoPct: descuentoNum,
      total: totalConDescuento,
      tipoPago: tipoPagoForzado || (pagoMultiple ? "mixto" : pagoSel),
      desglosePago,
      facturada: facturar,
    };
    persist({ ...negocioData, productos: nuevosProductos, ventas: [venta, ...negocioData.ventas] });
    setCarrito([]);
    setDescuentoPct("");
    setPagoMultiple(false);
    setMontosPago({ efectivo: "", transferencia: "", credito: "", debito: "", mercadopago: "" });
  }

  function abrirCaja() {
    const monto = Number(montoApertura);
    if (montoApertura.trim() === "" || isNaN(monto) || monto < 0) {
      setErrorCaja("Ingresá un monto inicial válido.");
      return;
    }
    persist({
      ...negocioData,
      caja: { abierta: true, montoInicial: monto, horaApertura: new Date().toISOString(), cierres: caja.cierres, retiros: [] },
    });
    setMontoApertura("");
    setErrorCaja("");
  }

  const ventasDesdeApertura = useMemo(() => {
    if (!caja.abierta || !caja.horaApertura) return [];
    const desde = new Date(caja.horaApertura).getTime();
    return negocioData.ventas.filter((v) => new Date(v.fecha).getTime() >= desde);
  }, [negocioData.ventas, caja.abierta, caja.horaApertura]);

  const resumenCaja = useMemo(() => calcularResumenPago(ventasDesdeApertura), [ventasDesdeApertura]);

  const retiros = caja.retiros || [];
  const totalRetiros = retiros.reduce((acc, r) => acc + r.monto, 0);
  const efectivoDisponible = caja.montoInicial + (resumenCaja.efectivo || 0) - totalRetiros;

  function registrarRetiro() {
    const monto = Number(montoRetiro);
    if (montoRetiro.trim() === "" || isNaN(monto) || monto <= 0) {
      setErrorRetiro("Ingresá un monto válido.");
      return;
    }
    if (monto > efectivoDisponible) {
      setErrorRetiro("No podés retirar más del efectivo disponible en caja (" + money(efectivoDisponible) + ").");
      return;
    }
    const retiro = {
      id: "r-" + Date.now(),
      monto,
      motivo: motivoRetiro.trim() || "Sin motivo",
      fecha: new Date().toISOString(),
    };
    persist({ ...negocioData, caja: { ...caja, retiros: [retiro, ...retiros] } });
    setMontoRetiro("");
    setMotivoRetiro("");
    setErrorRetiro("");
    setMostrarRetiro(false);
  }

  function cerrarCajaConfirmar() {
    const efectivoFinal = efectivoDisponible;
    const cierre = {
      id: "c-" + Date.now(),
      horaApertura: caja.horaApertura,
      horaCierre: new Date().toISOString(),
      montoInicial: caja.montoInicial,
      totalRetiros,
      efectivoFinal,
      ...resumenCaja,
    };
    persist({
      ...negocioData,
      caja: { abierta: false, montoInicial: 0, horaApertura: null, cierres: [cierre, ...caja.cierres], retiros: [] },
    });
    setMostrarCierre(false);
    setMontoApertura(String(efectivoFinal));
  }

  function iniciarEdicion(p) {
    setEditandoId(p.id);
    setFormEdicion({
      nombre: p.nombre,
      sku: p.sku,
      precio: tieneTalles(p) ? "" : String(p.precio),
      stock: tieneTalles(p) ? "" : String(p.stock),
      categoria: p.categoria || "uniforme",
    });
  }

  function guardarEdicion(id) {
    const producto = negocioData.productos.find((p) => p.id === id);
    if (!formEdicion.nombre.trim()) {
      setErrorForm("Ingresá un nombre.");
      return;
    }
    if (!tieneTalles(producto)) {
      const precio = Number(formEdicion.precio);
      const stock = Number(formEdicion.stock);
      if (isNaN(precio) || isNaN(stock) || precio < 0 || stock < 0) {
        setErrorForm("Revisá nombre, precio y stock.");
        return;
      }
    }
    const nuevosProductos = negocioData.productos.map((p) => {
      if (p.id !== id) return p;
      const base = {
        ...p,
        nombre: formEdicion.nombre.trim(),
        sku: formEdicion.sku.trim(),
        ...(negocioId === "colegio" ? { categoria: formEdicion.categoria } : {}),
      };
      if (!tieneTalles(p)) {
        base.precio = Number(formEdicion.precio);
        base.stock = Number(formEdicion.stock);
      }
      return base;
    });
    persist({ ...negocioData, productos: nuevosProductos });
    setEditandoId(null);
    setErrorForm("");
  }

  function borrarProducto(id) {
    persist({ ...negocioData, productos: negocioData.productos.filter((p) => p.id !== id) });
  }

  function agregarProducto() {
    const precio = Number(nuevoProducto.precio);
    const stock = Number(nuevoProducto.stock);
    const esUniformeNuevo = negocioId === "colegio" && nuevoProducto.categoria === "uniforme";
    if (!nuevoProducto.nombre.trim() || isNaN(precio) || isNaN(stock) || precio < 0 || stock < 0) {
      setErrorForm("Completá nombre, precio y stock (números válidos).");
      return;
    }
    if (esUniformeNuevo && !nuevoProducto.talle.trim()) {
      setErrorForm("Ingresá el talle inicial (después podés agregar más).");
      return;
    }
    const producto = esUniformeNuevo
      ? {
          id: "p-" + Date.now(),
          nombre: nuevoProducto.nombre.trim(),
          sku: nuevoProducto.sku.trim() || "-",
          categoria: "uniforme",
          talles: [{ talle: nuevoProducto.talle.trim(), precio, stock }],
        }
      : {
          id: "p-" + Date.now(),
          nombre: nuevoProducto.nombre.trim(),
          sku: nuevoProducto.sku.trim() || "-",
          precio,
          stock,
          ...(negocioId === "colegio" ? { categoria: nuevoProducto.categoria } : {}),
        };
    persist({ ...negocioData, productos: [...negocioData.productos, producto] });
    setNuevoProducto({ nombre: "", sku: "", precio: "", stock: "", categoria: "uniforme", talle: "" });
    setErrorForm("");
  }

  function iniciarEdicionTalle(productoId, t) {
    setEditandoTalle(productoId + "|" + t.talle);
    setFormTalle({ precio: String(t.precio), stock: String(t.stock) });
    setErrorTalle("");
  }

  function cancelarEdicionTalle() {
    setEditandoTalle(null);
    setErrorTalle("");
  }

  function guardarEdicionTalle(productoId, talleOriginal) {
    const precio = Number(formTalle.precio);
    const stock = Number(formTalle.stock);
    if (isNaN(precio) || isNaN(stock) || precio < 0 || stock < 0) {
      setErrorTalle("Revisá precio y stock.");
      return;
    }
    const nuevosProductos = negocioData.productos.map((p) =>
      p.id === productoId
        ? { ...p, talles: p.talles.map((t) => (t.talle === talleOriginal ? { ...t, precio, stock } : t)) }
        : p
    );
    persist({ ...negocioData, productos: nuevosProductos });
    setEditandoTalle(null);
    setErrorTalle("");
  }

  function borrarTalle(productoId, talle) {
    const nuevosProductos = negocioData.productos.map((p) =>
      p.id === productoId ? { ...p, talles: p.talles.filter((t) => t.talle !== talle) } : p
    );
    persist({ ...negocioData, productos: nuevosProductos });
  }

  function iniciarAgregarTalle(productoId) {
    setAgregandoTalleEn(productoId);
    setFormNuevoTalle({ talle: "", precio: "", stock: "" });
    setErrorTalle("");
  }

  function guardarNuevoTalle(productoId) {
    const precio = Number(formNuevoTalle.precio);
    const stock = Number(formNuevoTalle.stock);
    const talleNombre = formNuevoTalle.talle.trim();
    if (!talleNombre || isNaN(precio) || isNaN(stock) || precio < 0 || stock < 0) {
      setErrorTalle("Completá talle, precio y stock (válidos).");
      return;
    }
    const producto = negocioData.productos.find((p) => p.id === productoId);
    if (producto && producto.talles.some((t) => t.talle === talleNombre)) {
      setErrorTalle("Ese talle ya existe para este producto.");
      return;
    }
    const nuevosProductos = negocioData.productos.map((p) =>
      p.id === productoId ? { ...p, talles: [...p.talles, { talle: talleNombre, precio, stock }] } : p
    );
    persist({ ...negocioData, productos: nuevosProductos });
    setAgregandoTalleEn(null);
    setFormNuevoTalle({ talle: "", precio: "", stock: "" });
    setErrorTalle("");
  }

  const ventasHoy = useMemo(
    () => negocioData.ventas.filter((v) => v.fecha.slice(0, 10) === todayKey()),
    [negocioData.ventas]
  );

  function calcularResumenPago(ventas) {
    const r = { efectivo: 0, transferencia: 0, credito: 0, debito: 0, mercadopago: 0, colegio: 0, total: 0, cantidad: ventas.length };
    ventas.forEach((v) => {
      if (v.desglosePago) {
        Object.keys(v.desglosePago).forEach((k) => {
          r[k] = (r[k] || 0) + v.desglosePago[k];
        });
      } else {
        r[v.tipoPago] = (r[v.tipoPago] || 0) + v.total;
      }
      r.total += v.total;
    });
    return r;
  }

  const resumenHoy = useMemo(() => calcularResumenPago(ventasHoy), [ventasHoy]);

  function labelPago(v) {
    if (v.tipoPago === "colegio") return "Cuenta Colegio";
    if (v.tipoPago === "mixto" && v.desglosePago) {
      return (
        "Pago múltiple (" +
        Object.entries(v.desglosePago)
          .map(([k, val]) => (PAGOS.find((p) => p.id === k)?.label || k) + " " + money(val))
          .join(", ") +
        ")"
      );
    }
    return PAGOS.find((p) => p.id === v.tipoPago)?.label || v.tipoPago;
  }

  function calcularResumenCategoria(ventas, productos) {
    const mapaCategoria = {};
    productos.forEach((p) => {
      mapaCategoria[p.id] = p.categoria;
    });
    const r = {};
    CATEGORIAS.forEach((c) => {
      r[c.id] = 0;
    });
    ventas.forEach((v) => {
      v.items.forEach((i) => {
        const cat = mapaCategoria[i.id];
        if (cat) r[cat] = (r[cat] || 0) + i.precio * i.cantidad;
      });
    });
    return r;
  }

  const resumenCategoriaHoy = useMemo(() => {
    if (negocioId !== "colegio") return null;
    return calcularResumenCategoria(ventasHoy, negocioData.productos);
  }, [ventasHoy, negocioData.productos, negocioId]);

  function filtrarPorPeriodo(ventas) {
    if (vistaTotales === "hoy") {
      return ventas.filter((v) => v.fecha.slice(0, 10) === todayKey());
    }
    if (vistaTotales === "dia") {
      return ventas.filter((v) => v.fecha.slice(0, 10) === fechaFiltro);
    }
    if (vistaTotales === "30dias") {
      const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return ventas.filter((v) => new Date(v.fecha).getTime() >= limite);
    }
    return ventas.filter((v) => {
      const dia = v.fecha.slice(0, 10);
      if (fechaDesde && dia < fechaDesde) return false;
      if (fechaHasta && dia > fechaHasta) return false;
      return true;
    });
  }

  const ventasVista = useMemo(() => {
    const ventasSinColegio = negocioData.ventas.filter((v) => v.tipoPago !== "colegio");
    return filtrarPorPeriodo(ventasSinColegio);
  }, [negocioData.ventas, vistaTotales, fechaFiltro, fechaDesde, fechaHasta]);

  const resumenVista = useMemo(() => calcularResumenPago(ventasVista), [ventasVista]);

  const totalUniformesComision = useMemo(() => {
    if (negocioId !== "colegio") return 0;
    const mapaCategoria = {};
    negocioData.productos.forEach((p) => {
      mapaCategoria[p.id] = p.categoria;
    });
    const ventasPeriodo = filtrarPorPeriodo(negocioData.ventas); // incluye Cuenta Colegio
    let total = 0;
    ventasPeriodo.forEach((v) => {
      v.items.forEach((i) => {
        if (mapaCategoria[i.id] === "uniforme") {
          const monto = i.precio * i.cantidad;
          total += monto * (1 - (v.descuentoPct || 0) / 100);
        }
      });
    });
    return total;
  }, [negocioData.ventas, negocioData.productos, negocioId, vistaTotales, fechaFiltro, fechaDesde, fechaHasta]);

  const comisionLuciana = totalUniformesComision * 0.05;

  const ventasCuentaColegioTodas = useMemo(
    () => negocioData.ventas.filter((v) => v.tipoPago === "colegio"),
    [negocioData.ventas]
  );
  const totalCuentaColegioTodas = useMemo(
    () => ventasCuentaColegioTodas.reduce((acc, v) => acc + v.total, 0),
    [ventasCuentaColegioTodas]
  );



  const resumenCategoriaVista = useMemo(() => {
    if (negocioId !== "colegio") return null;
    return calcularResumenCategoria(ventasVista, negocioData.productos);
  }, [ventasVista, negocioData.productos, negocioId]);

  function formatFecha(f) {
    return new Date(f + "T00:00:00").toLocaleDateString("es-AR");
  }

  function tituloHistorico() {
    if (fechaDesde && fechaHasta) return "Informe del " + formatFecha(fechaDesde) + " al " + formatFecha(fechaHasta);
    if (fechaDesde) return "Informe desde el " + formatFecha(fechaDesde);
    if (fechaHasta) return "Informe hasta el " + formatFecha(fechaHasta);
    return "Informe histórico";
  }

  if (!usuario) {
    return <LoginScreen onLogin={iniciarSesion} />;
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-screen bg-blue-50 text-slate-800">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, .min-h-screen { background: white !important; }
        }
      `}</style>
      {/* Header */}
      <header className="no-print bg-gradient-to-r from-sky-400 to-blue-600 text-white px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="font-bold text-lg flex items-center gap-2">
            Rastex Gestión
            <span className="text-xs font-normal bg-white/20 rounded-full px-2 py-0.5">
              {usuario.nombre}
            </span>
          </span>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setMenuAbierto((v) => !v)}
                className="flex items-center gap-2 bg-white text-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: negocio.color }} />
                {negocio.nombre}
                <ChevronDown size={15} className="text-blue-600" />
              </button>
              {menuAbierto && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-black/5 overflow-hidden z-20">
                  {negociosVisibles.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setNegocioId(n.id);
                        setMenuAbierto(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-black/5 text-left text-slate-800"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: n.color }} />
                      <span>{n.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={cerrarSesion}
              title="Cerrar sesión"
              className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {negocioId === "colegio" && (
          <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {CATEGORIAS.map((c) => (
              <p key={c.id} className="text-xs text-white/80 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}: <span className="font-mono font-semibold text-white">{money((resumenCategoriaHoy && resumenCategoriaHoy[c.id]) || 0)}</span>
              </p>
            ))}
            <p className="text-xs text-white/80">
              Total hoy: <span className="font-mono font-bold text-white">{money(resumenHoy.total)}</span>
            </p>
          </div>
        )}

        <div className="max-w-4xl mx-auto flex gap-1 mt-3">
          {tabsVisibles.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition " +
                (tab === t.id ? "bg-white text-blue-600" : "text-white/85 hover:bg-white/15")
              }
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {loading ? (
          <p className="text-sm text-black/40 pt-10 text-center">Cargando {negocio.nombre}...</p>
        ) : tab === "venta" ? (
          <div>
            {!caja.abierta ? (
              <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-0.5">Caja cerrada</p>
                  <p className="text-xs text-black/40">
                    {caja.cierres.length > 0
                      ? "Efectivo precargado según el cierre anterior. Podés ajustarlo si contaste distinto."
                      : "Abrí la caja para empezar a vender y declarar el efectivo inicial."}
                  </p>
                  {errorCaja && <p className="text-xs text-red-600 mt-1">{errorCaja}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Efectivo inicial"
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    className="w-36 px-3 py-2 rounded-lg border border-black/15 text-sm font-mono"
                  />
                  <button
                    onClick={abrirCaja}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:brightness-110 whitespace-nowrap"
                  >
                    Abrir caja
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm mb-0.5">Caja abierta</p>
                  <p className="text-xs text-black/40">
                    Desde las {new Date(caja.horaApertura).toLocaleTimeString("es-AR")} · Efectivo inicial {money(caja.montoInicial)}
                    {" · "}Efectivo en caja ahora: <span className="font-semibold text-black/70">{money(efectivoDisponible)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!mostrarCierre && (
                    <button
                      onClick={() => {
                        setMostrarRetiro((v) => !v);
                        setMostrarCierre(false);
                      }}
                      className="px-4 py-2 rounded-lg border border-black/15 text-slate-800 font-bold text-sm hover:bg-black/5 whitespace-nowrap"
                    >
                      Retiro de efectivo
                    </button>
                  )}
                  {!mostrarRetiro && (
                    <button
                      onClick={() => {
                        setMostrarCierre(true);
                        setMostrarRetiro(false);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold text-sm hover:brightness-110 whitespace-nowrap"
                    >
                      Cerrar caja
                    </button>
                  )}
                </div>
              </div>
            )}

            {mostrarRetiro && (
              <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-4">
                <h2 className="font-bold mb-3 text-sm">Registrar retiro de efectivo</h2>
                <p className="text-xs text-black/40 mb-3">Efectivo disponible ahora: {money(efectivoDisponible)}</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <input
                    type="number"
                    placeholder="Monto"
                    value={montoRetiro}
                    onChange={(e) => setMontoRetiro(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-black/15 text-sm font-mono"
                  />
                  <input
                    placeholder="Motivo (opcional)"
                    value={motivoRetiro}
                    onChange={(e) => setMotivoRetiro(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-black/15 text-sm"
                  />
                </div>
                {errorRetiro && <p className="text-xs text-red-600 mb-2">{errorRetiro}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={registrarRetiro}
                    className="flex-1 py-2.5 rounded-lg bg-slate-800 text-white font-bold text-sm hover:brightness-110"
                  >
                    Confirmar retiro
                  </button>
                  <button
                    onClick={() => {
                      setMostrarRetiro(false);
                      setErrorRetiro("");
                    }}
                    className="px-4 py-2.5 rounded-lg border border-black/10 text-sm text-black/60 hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                </div>
                {retiros.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-black/5 space-y-1">
                    {retiros.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs text-black/50">
                        <span>{new Date(r.fecha).toLocaleTimeString("es-AR")} · {r.motivo}</span>
                        <span className="font-mono">-{money(r.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mostrarCierre && (
              <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-4">
                <h2 className="font-bold mb-3">Resumen para cerrar caja</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-black/40 mb-1">Ventas</p>
                    <p className="font-mono font-bold">{resumenCaja.cantidad}</p>
                  </div>
                  {PAGOS.map((p) => (
                    <div key={p.id} className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-black/40 mb-1">{p.label}</p>
                      <p className="font-mono font-bold">{money(resumenCaja[p.id] || 0)}</p>
                    </div>
                  ))}
                </div>
                {retiros.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 mb-4 flex items-center justify-between">
                    <span className="text-sm text-black/60">Retiros de efectivo ({retiros.length})</span>
                    <span className="font-mono font-bold text-red-600">-{money(totalRetiros)}</span>
                  </div>
                )}
                <div className="bg-slate-800 text-white rounded-lg p-3 flex items-center justify-between mb-4">
                  <span className="font-medium text-sm">Efectivo esperado en caja</span>
                  <span className="font-mono font-bold text-lg">
                    {money(efectivoDisponible)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cerrarCajaConfirmar}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold text-sm hover:brightness-110"
                  >
                    Confirmar cierre de caja
                  </button>
                  <button
                    onClick={() => setMostrarCierre(false)}
                    className="px-4 py-2.5 rounded-lg border border-black/10 text-sm text-black/60 hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {caja.abierta && !mostrarCierre && (
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-3">
              <h1 className="text-xl font-bold mb-4">Productos — {negocio.nombre}</h1>

              {negocioId === "colegio" && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={() => setCategoriaFiltro("todos")}
                    className={
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition " +
                      (categoriaFiltro === "todos" ? "bg-slate-800 text-white border-slate-800" : "border-black/15 text-black/60 hover:border-black/30")
                    }
                  >
                    Todos
                  </button>
                  {CATEGORIAS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoriaFiltro(c.id)}
                      className={
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 " +
                        (categoriaFiltro === c.id ? "text-white border-transparent" : "border-black/15 text-black/60 hover:border-black/30")
                      }
                      style={categoriaFiltro === c.id ? { backgroundColor: c.color } : {}}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {negocioData.productos
                  .filter((p) => negocioId !== "colegio" || categoriaFiltro === "todos" || p.categoria === categoriaFiltro)
                  .map((p) => {
                    const cat = CATEGORIAS.find((c) => c.id === p.categoria);
                    return (
                      <div
                        key={p.id}
                        className="bg-white rounded-xl p-3 shadow-sm border border-black/5 hover:border-blue-600 hover:shadow-md transition"
                      >
                        {cat && (
                          <span
                            className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1.5 text-white"
                            style={{ backgroundColor: cat.color }}
                          >
                            {cat.label}
                          </span>
                        )}
                        <p className="text-sm font-semibold leading-tight mb-1">{p.nombre}</p>
                        <p className="text-xs text-black/40 mb-2 font-mono">{p.sku}</p>

                        {tieneTalles(p) ? (
                          (() => {
                            const talleActual = talleElegido[p.id] || (p.talles[0] && p.talles[0].talle) || "";
                            const t = p.talles.find((x) => x.talle === talleActual) || p.talles[0];
                            return (
                              <div className="space-y-1.5">
                                <select
                                  value={talleActual}
                                  onChange={(e) => setTalleElegido((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  className="w-full px-2 py-1.5 rounded-lg border border-black/15 text-xs bg-white"
                                >
                                  {p.talles.map((x) => (
                                    <option key={x.talle} value={x.talle} disabled={x.stock <= 0}>
                                      Talle {x.talle} — {money(x.precio)} {x.stock <= 0 ? "(sin stock)" : "(x" + x.stock + ")"}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => t && agregarAlCarrito(p, t.talle, t.precio)}
                                  disabled={!t || t.stock <= 0}
                                  className="w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-30 hover:brightness-110 transition"
                                >
                                  Agregar
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <button
                            onClick={() => agregarAlCarrito(p, null, p.precio)}
                            disabled={p.stock <= 0}
                            className="w-full text-left disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-blue-600">{money(p.precio)}</span>
                              <span className={"text-xs font-mono " + (p.stock < UMBRAL_STOCK_BAJO ? "text-red-600" : "text-black/40")}>
                                {p.stock <= 0 ? "sin stock" : "x" + p.stock}
                              </span>
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                {negocioData.productos.length === 0 && (
                  <p className="text-sm text-black/40 col-span-full">
                    No hay productos cargados. Andá a la pestaña Stock para agregar el primero.
                  </p>
                )}
              </div>
            </div>

            <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-black/5 p-4 h-fit">
              <h2 className="font-bold mb-3">Venta actual</h2>
              {carrito.length === 0 ? (
                <p className="text-sm text-black/40">Tocá un producto para agregarlo.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {carrito.map((i) => (
                    <div key={i.cartId} className="flex items-center justify-between text-sm gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{i.nombre}</p>
                        <p className="font-mono text-xs text-black/40">{money(i.precio)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => cambiarCantidad(i.cartId, -1)} className="w-6 h-6 rounded bg-black/5 hover:bg-black/10 flex items-center justify-center">
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center font-mono">{i.cantidad}</span>
                        <button onClick={() => cambiarCantidad(i.cartId, 1)} className="w-6 h-6 rounded bg-black/5 hover:bg-black/10 flex items-center justify-center">
                          <Plus size={12} />
                        </button>
                        <button onClick={() => quitarDelCarrito(i.cartId)} className="w-6 h-6 rounded hover:bg-red-50 text-red-600 flex items-center justify-center ml-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-black/10 pt-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-black/60 flex items-center gap-2">
                    Descuento
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={descuentoPct}
                      onChange={(e) => setDescuentoPct(e.target.value)}
                      className="w-16 px-2 py-1 rounded border border-black/15 text-sm font-mono text-right"
                    />
                    <span className="text-black/40">%</span>
                  </label>
                  {descuentoNum > 0 && (
                    <span className="font-mono text-sm text-red-600">-{money(montoDescuento)}</span>
                  )}
                </div>
                {descuentoNum > 0 && (
                  <div className="flex items-center justify-between text-xs text-black/40 mb-1">
                    <span>Subtotal</span>
                    <span className="font-mono">{money(totalCarrito)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-mono font-bold text-lg">{money(totalConDescuento)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-black/50">
                  {pagoMultiple ? "Repartir entre medios de pago" : "Medio de pago"}
                </span>
                <button
                  onClick={() => setPagoMultiple((v) => !v)}
                  className="text-xs text-blue-600 font-medium hover:underline"
                >
                  {pagoMultiple ? "Usar un solo medio" : "Pago múltiple"}
                </button>
              </div>

              {!pagoMultiple ? (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {PAGOS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPagoSel(p.id)}
                      className={
                        "flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium border transition " +
                        (pagoSel === p.id ? "bg-blue-600 text-white border-blue-600" : "border-black/10 text-black/60 hover:border-black/30")
                      }
                    >
                      <p.icon size={15} />
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mb-3 space-y-1.5">
                  {PAGOS.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <p.icon size={14} className="text-black/40 shrink-0" />
                      <span className="text-xs text-black/60 flex-1">{p.label}</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={montosPago[p.id]}
                        onChange={(e) => setMontosPago((m) => ({ ...m, [p.id]: e.target.value }))}
                        className="w-24 px-2 py-1 rounded border border-black/15 text-sm font-mono text-right"
                      />
                    </div>
                  ))}
                  <div
                    className={
                      "flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-black/10 " +
                      (pagoMultipleValido ? "text-green-700" : "text-red-600")
                    }
                  >
                    <span>Asignado</span>
                    <span className="font-mono font-semibold">
                      {money(totalAsignadoMultiple)} / {money(totalConDescuento)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={() => confirmarVenta(true)}
                disabled={carrito.length === 0 || (pagoMultiple && !pagoMultipleValido)}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-bold text-sm disabled:opacity-30 hover:brightness-110 transition mb-2"
              >
                Facturar
              </button>
              <button
                onClick={() => confirmarVenta(false)}
                disabled={carrito.length === 0 || (pagoMultiple && !pagoMultipleValido)}
                className="w-full py-2.5 rounded-lg border border-black/15 text-slate-800 font-semibold text-sm disabled:opacity-30 hover:bg-black/5 transition"
              >
                Facturar luego
              </button>
              <button
                onClick={() => confirmarVenta(false, "colegio")}
                disabled={carrito.length === 0}
                className="w-full py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-semibold text-sm disabled:opacity-30 hover:bg-amber-100 transition mt-2"
              >
                Cuenta Colegio
              </button>
              <p className="text-[11px] text-black/35 mt-2 text-center">
                "Facturar" va a conectar con ARCA (vía TusFacturasAPP/Facturante) cuando esté armada esa parte. Por ahora solo queda marcada la venta como facturada. "Cuenta Colegio" cierra la venta directo, sin pasar por caja — la liquida la dirección.
              </p>
            </div>
          </div>
            )}
          </div>
        ) : tab === "stock" && verStockBajo ? (
          <div>
            <div className="flex items-center justify-between mb-4 no-print">
              <h1 className="text-xl font-bold">Stock bajo (menos de {UMBRAL_STOCK_BAJO} unidades) — {negocio.nombre}</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/15 text-xs font-medium text-black/60 hover:bg-black/5"
                >
                  <Printer size={14} /> Imprimir
                </button>
                <button
                  onClick={() => setVerStockBajo(false)}
                  className="text-sm text-blue-600 font-medium hover:underline"
                >
                  ← Volver a Stock
                </button>
              </div>
            </div>
            <h1 className="hidden print:block text-xl font-bold mb-4">
              Stock bajo (menos de {UMBRAL_STOCK_BAJO} unidades) — {negocio.nombre}
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-black/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-black/40">
                  <tr>
                    <th className="px-4 py-2.5">Producto</th>
                    {negocioId === "colegio" && <th className="px-4 py-2.5">Categoría</th>}
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {listaStockBajo.length === 0 ? (
                    <tr>
                      <td colSpan={negocioId === "colegio" ? 4 : 3} className="px-4 py-6 text-center text-sm text-black/40">
                        No hay productos con stock bajo. 🎉
                      </td>
                    </tr>
                  ) : (
                    listaStockBajo.map((it, idx) => {
                      const cat = CATEGORIAS.find((c) => c.id === it.categoria);
                      return (
                        <tr key={idx} className="border-t border-black/5">
                          <td className="px-4 py-2.5 font-medium">{it.nombre}</td>
                          {negocioId === "colegio" && (
                            <td className="px-4 py-2.5">
                              {cat ? (
                                <span
                                  className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: cat.color }}
                                >
                                  {cat.label}
                                </span>
                              ) : (
                                <span className="text-black/30 text-xs">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-2.5 font-mono text-black/50">{it.sku}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-red-600">{it.stock}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === "stock" ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Stock — {negocio.nombre}</h1>
              <button
                onClick={() => window.print()}
                className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/15 text-xs font-medium text-black/60 hover:bg-black/5"
              >
                <Printer size={14} /> Imprimir
              </button>
            </div>

            {listaStockBajo.length > 0 && (
              <button
                onClick={() => setVerStockBajo(true)}
                className="no-print w-full bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center justify-between hover:bg-red-100 transition"
              >
                <p className="font-semibold text-sm text-red-800">
                  ⚠ {listaStockBajo.length} producto{listaStockBajo.length === 1 ? "" : "s"} con stock bajo (menos de {UMBRAL_STOCK_BAJO} unidades)
                </p>
                <span className="text-xs text-red-700 font-medium">Ver / imprimir →</span>
              </button>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-black/5 overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-black/40">
                  <tr>
                    <th className="px-4 py-2.5">Producto</th>
                    {negocioId === "colegio" && <th className="px-4 py-2.5">Categoría</th>}
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5 text-right">Precio</th>
                    <th className="px-4 py-2.5 text-right">Stock</th>
                    <th className="px-4 py-2.5 text-right no-print">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {negocioData.productos.map((p) =>
                    editandoId === p.id ? (
                      <tr key={p.id} className="border-t border-black/5 bg-blue-50">
                        <td className="px-2 py-2">
                          <input
                            value={formEdicion.nombre}
                            onChange={(e) => setFormEdicion((f) => ({ ...f, nombre: e.target.value }))}
                            className="w-full px-2 py-1 rounded border border-black/15 text-sm"
                          />
                        </td>
                        {negocioId === "colegio" && (
                          <td className="px-2 py-2">
                            <select
                              value={formEdicion.categoria}
                              onChange={(e) => setFormEdicion((f) => ({ ...f, categoria: e.target.value }))}
                              className="w-full px-2 py-1 rounded border border-black/15 text-sm bg-white"
                            >
                              {CATEGORIAS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="px-2 py-2">
                          <input
                            value={formEdicion.sku}
                            onChange={(e) => setFormEdicion((f) => ({ ...f, sku: e.target.value }))}
                            className="w-full px-2 py-1 rounded border border-black/15 text-sm font-mono"
                          />
                        </td>
                        <td className="px-2 py-2">
                          {tieneTalles(p) ? (
                            <span className="text-xs text-black/30">Ver talles abajo</span>
                          ) : (
                            <input
                              type="number"
                              value={formEdicion.precio}
                              onChange={(e) => setFormEdicion((f) => ({ ...f, precio: e.target.value }))}
                              className="w-24 px-2 py-1 rounded border border-black/15 text-sm text-right font-mono ml-auto block"
                            />
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {!tieneTalles(p) && (
                            <input
                              type="number"
                              value={formEdicion.stock}
                              onChange={(e) => setFormEdicion((f) => ({ ...f, stock: e.target.value }))}
                              className="w-20 px-2 py-1 rounded border border-black/15 text-sm text-right font-mono ml-auto block"
                            />
                          )}
                        </td>
                        <td className="px-2 py-2 no-print">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => guardarEdicion(p.id)} className="w-7 h-7 rounded bg-green-700 text-white flex items-center justify-center">
                              <Check size={14} />
                            </button>
                            <button onClick={() => { setEditandoId(null); setErrorForm(""); }} className="w-7 h-7 rounded bg-black/10 flex items-center justify-center">
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={p.id} className="border-t border-black/5">
                        <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                        {negocioId === "colegio" && (
                          <td className="px-4 py-2.5">
                            {(() => {
                              const cat = CATEGORIAS.find((c) => c.id === p.categoria);
                              return cat ? (
                                <span
                                  className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: cat.color }}
                                >
                                  {cat.label}
                                </span>
                              ) : (
                                <span className="text-black/30 text-xs">—</span>
                              );
                            })()}
                          </td>
                        )}
                        <td className="px-4 py-2.5 font-mono text-black/50">{p.sku}</td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {tieneTalles(p) ? <span className="text-black/30 text-xs">Ver abajo</span> : money(p.precio)}
                        </td>
                        <td className={"px-4 py-2.5 text-right font-mono font-semibold " + (stockTotal(p) < UMBRAL_STOCK_BAJO ? "text-red-600" : "")}>
                          {stockTotal(p)}
                        </td>
                        <td className="px-4 py-2.5 no-print">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => iniciarEdicion(p)} className="w-7 h-7 rounded hover:bg-black/5 flex items-center justify-center text-black/50">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => borrarProducto(p.id)} className="w-7 h-7 rounded hover:bg-red-50 text-red-600 flex items-center justify-center">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                  {negocioData.productos.map(
                    (p) =>
                      tieneTalles(p) && (
                        <tr key={p.id + "-talles"} className="border-t border-black/5 bg-black/[0.02]">
                          <td colSpan={negocioId === "colegio" ? 6 : 5} className="px-4 py-3">
                            <p className="text-xs font-semibold text-black/40 mb-2">Talles — {p.nombre}</p>
                            <div className="space-y-1.5">
                              {p.talles.map((t) =>
                                editandoTalle === p.id + "|" + t.talle ? (
                                  <div key={t.talle} className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                                    <span className="text-xs font-semibold w-16 shrink-0">Talle {t.talle}</span>
                                    <input
                                      type="number"
                                      value={formTalle.precio}
                                      onChange={(e) => setFormTalle((f) => ({ ...f, precio: e.target.value }))}
                                      placeholder="Precio"
                                      className="w-24 px-2 py-1 rounded border border-black/15 text-sm font-mono"
                                    />
                                    <input
                                      type="number"
                                      value={formTalle.stock}
                                      onChange={(e) => setFormTalle((f) => ({ ...f, stock: e.target.value }))}
                                      placeholder="Stock"
                                      className="w-20 px-2 py-1 rounded border border-black/15 text-sm font-mono"
                                    />
                                    <button onClick={() => guardarEdicionTalle(p.id, t.talle)} className="w-7 h-7 rounded bg-green-700 text-white flex items-center justify-center shrink-0">
                                      <Check size={13} />
                                    </button>
                                    <button onClick={cancelarEdicionTalle} className="w-7 h-7 rounded bg-black/10 flex items-center justify-center shrink-0">
                                      <X size={13} />
                                    </button>
                                  </div>
                                ) : (
                                  <div key={t.talle} className="flex items-center gap-2 text-sm">
                                    <span className="w-16 shrink-0 font-medium text-xs text-black/60">Talle {t.talle}</span>
                                    <span className="font-mono w-20 shrink-0">{money(t.precio)}</span>
                                    <span className={"font-mono w-16 shrink-0 " + (t.stock < UMBRAL_STOCK_BAJO ? "text-red-600" : "text-black/50")}>x{t.stock}</span>
                                    <button onClick={() => iniciarEdicionTalle(p.id, t)} className="w-6 h-6 rounded hover:bg-black/5 flex items-center justify-center text-black/40 shrink-0">
                                      <Pencil size={12} />
                                    </button>
                                    <button onClick={() => borrarTalle(p.id, t.talle)} className="w-6 h-6 rounded hover:bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )
                              )}

                              {agregandoTalleEn === p.id ? (
                                <div className="flex items-center gap-2 pt-1 flex-wrap">
                                  <input
                                    placeholder="Talle"
                                    value={formNuevoTalle.talle}
                                    onChange={(e) => setFormNuevoTalle((f) => ({ ...f, talle: e.target.value }))}
                                    className="w-16 px-2 py-1 rounded border border-black/15 text-sm"
                                  />
                                  <input
                                    type="number"
                                    placeholder="Precio"
                                    value={formNuevoTalle.precio}
                                    onChange={(e) => setFormNuevoTalle((f) => ({ ...f, precio: e.target.value }))}
                                    className="w-24 px-2 py-1 rounded border border-black/15 text-sm font-mono"
                                  />
                                  <input
                                    type="number"
                                    placeholder="Stock"
                                    value={formNuevoTalle.stock}
                                    onChange={(e) => setFormNuevoTalle((f) => ({ ...f, stock: e.target.value }))}
                                    className="w-20 px-2 py-1 rounded border border-black/15 text-sm font-mono"
                                  />
                                  <button onClick={() => guardarNuevoTalle(p.id)} className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-bold">
                                    Agregar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAgregandoTalleEn(null);
                                      setErrorTalle("");
                                    }}
                                    className="text-xs text-black/40 hover:underline"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => iniciarAgregarTalle(p.id)} className="text-xs text-blue-600 font-medium hover:underline pt-1">
                                  + Agregar talle
                                </button>
                              )}
                              {errorTalle && (agregandoTalleEn === p.id || (editandoTalle && editandoTalle.startsWith(p.id + "|"))) && (
                                <p className="text-xs text-red-600">{errorTalle}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                  )}
                  {negocioData.productos.length === 0 && (
                    <tr>
                      <td colSpan={negocioId === "colegio" ? 6 : 5} className="px-4 py-6 text-center text-sm text-black/40">
                        Todavía no cargaste productos para este negocio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="no-print bg-white rounded-xl shadow-sm border border-black/5 p-4">
              <h2 className="font-bold mb-3 text-sm">Cargar producto nuevo</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <input
                  placeholder="Nombre"
                  value={nuevoProducto.nombre}
                  onChange={(e) => setNuevoProducto((f) => ({ ...f, nombre: e.target.value }))}
                  className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg border border-black/15 text-sm"
                />
                {negocioId === "colegio" && (
                  <select
                    value={nuevoProducto.categoria}
                    onChange={(e) => setNuevoProducto((f) => ({ ...f, categoria: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-black/15 text-sm bg-white"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  placeholder="SKU (opcional)"
                  value={nuevoProducto.sku}
                  onChange={(e) => setNuevoProducto((f) => ({ ...f, sku: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-black/15 text-sm font-mono"
                />
                <input
                  type="number"
                  placeholder="Precio"
                  value={nuevoProducto.precio}
                  onChange={(e) => setNuevoProducto((f) => ({ ...f, precio: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-black/15 text-sm font-mono"
                />
                <input
                  type="number"
                  placeholder="Stock inicial"
                  value={nuevoProducto.stock}
                  onChange={(e) => setNuevoProducto((f) => ({ ...f, stock: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-black/15 text-sm font-mono"
                />
                {negocioId === "colegio" && nuevoProducto.categoria === "uniforme" && (
                  <input
                    placeholder="Talle inicial (ej: 6, 10, M)"
                    value={nuevoProducto.talle}
                    onChange={(e) => setNuevoProducto((f) => ({ ...f, talle: e.target.value }))}
                    className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg border border-black/15 text-sm"
                  />
                )}
              </div>
              {negocioId === "colegio" && nuevoProducto.categoria === "uniforme" && (
                <p className="text-xs text-black/40 mb-2">
                  El precio y stock de arriba son para este talle inicial. Después podés agregar más talles (cada uno con su propio precio y stock) desde la fila del producto.
                </p>
              )}
              {errorForm && <p className="text-xs text-red-600 mb-2">{errorForm}</p>}
              <button
                onClick={agregarProducto}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:brightness-110"
              >
                <Plus size={15} /> Agregar producto
              </button>
            </div>

            <p className="text-xs text-black/40 mt-3">El stock se descuenta solo cada vez que confirmás una venta en "Vender".</p>
          </div>
        ) : verCuentaColegio ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Cuenta Colegio — {negocio.nombre}</h1>
              <button
                onClick={() => setVerCuentaColegio(false)}
                className="text-sm text-blue-600 font-medium hover:underline"
              >
                ← Volver a Informes
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-amber-900">Total histórico a cobrarle a dirección</p>
                <p className="text-xs text-amber-700/70">
                  {ventasCuentaColegioTodas.length} venta{ventasCuentaColegioTodas.length === 1 ? "" : "s"} en total
                </p>
              </div>
              <span className="font-mono font-bold text-2xl text-amber-800">{money(totalCuentaColegioTodas)}</span>
            </div>

            <h2 className="font-bold mb-2 text-sm">Detalle de todas las ventas a Cuenta Colegio</h2>
            <div className="bg-white rounded-xl shadow-sm border border-black/5 divide-y divide-black/5">
              {ventasCuentaColegioTodas.length === 0 ? (
                <p className="p-4 text-sm text-black/40">Todavía no hay ventas a Cuenta Colegio.</p>
              ) : (
                ventasCuentaColegioTodas.map((v) => (
                  <div key={v.id} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{v.items.map((i) => i.cantidad + "x " + i.nombre).join(", ")}</p>
                      <p className="text-xs text-black/40">
                        {new Date(v.fecha).toLocaleDateString("es-AR")} {new Date(v.fecha).toLocaleTimeString("es-AR")}
                        {v.descuentoPct > 0 && <span className="text-red-600"> · {v.descuentoPct}% off</span>}
                      </p>
                    </div>
                    <span className="font-mono font-semibold">{money(v.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h1 className="text-xl font-bold">
                  {(vistaTotales === "hoy"
                    ? "Informe del día"
                    : vistaTotales === "dia"
                    ? "Informe del " + new Date(fechaFiltro + "T00:00:00").toLocaleDateString("es-AR")
                    : vistaTotales === "30dias"
                    ? "Informe últimos 30 días"
                    : tituloHistorico()) + " — " + negocio.nombre}
                </h1>
                <button
                  onClick={() => window.print()}
                  className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/15 text-xs font-medium text-black/60 hover:bg-black/5 shrink-0"
                >
                  <Printer size={14} /> Imprimir
                </button>
              </div>
              <div className="no-print flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap rounded-lg bg-black/5 p-0.5 text-xs">
                  {FILTROS_PERIODO.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setVistaTotales(f.id)}
                      className={
                        "px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap " +
                        (vistaTotales === f.id ? "bg-white shadow-sm text-blue-600" : "text-black/50")
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {vistaTotales === "dia" && (
                  <input
                    type="date"
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value)}
                    max={todayKey()}
                    className="px-3 py-1.5 rounded-lg border border-black/15 text-sm"
                  />
                )}
                {vistaTotales === "historico" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs text-black/50">
                      Desde
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        max={fechaHasta || todayKey()}
                        className="px-3 py-1.5 rounded-lg border border-black/15 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-black/50">
                      Hasta
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        min={fechaDesde}
                        max={todayKey()}
                        className="px-3 py-1.5 rounded-lg border border-black/15 text-sm"
                      />
                    </label>
                    {(fechaDesde || fechaHasta) && (
                      <button
                        onClick={() => {
                          setFechaDesde("");
                          setFechaHasta("");
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver todo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-black/5">
                <p className="text-xs text-black/40 mb-1">Ventas</p>
                <p className="font-mono font-bold text-xl">{resumenVista.cantidad}</p>
              </div>
              {PAGOS.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-black/5">
                  <p className="text-xs text-black/40 mb-1">{p.label}</p>
                  <p className="font-mono font-bold text-xl">{money(resumenVista[p.id] || 0)}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-4 mb-6 flex items-center justify-between">
              <span className="font-medium">
                {vistaTotales === "hoy"
                  ? "Total del día"
                  : vistaTotales === "dia"
                  ? "Total del día seleccionado"
                  : vistaTotales === "30dias"
                  ? "Total últimos 30 días"
                  : "Total histórico"}
              </span>
              <span className="font-mono font-bold text-2xl">{money(resumenVista.total)}</span>
            </div>

            {ventasCuentaColegioTodas.length > 0 && (
              <button
                onClick={() => setVerCuentaColegio(true)}
                className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between hover:bg-amber-100 transition"
              >
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-amber-700" />
                  <div className="text-left">
                    <p className="font-semibold text-sm text-amber-900">Cuenta Colegio (a cobrarle a dirección)</p>
                    <p className="text-xs text-amber-700/70">
                      {ventasCuentaColegioTodas.length} venta{ventasCuentaColegioTodas.length === 1 ? "" : "s"} · no está sumado en los totales de arriba
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-lg text-amber-800">{money(totalCuentaColegioTodas)}</span>
              </button>
            )}

            {negocioId === "colegio" && (
              <button
                onClick={() => setVerComision((v) => !v)}
                className="w-full bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6 flex items-center justify-between hover:bg-violet-100 transition"
              >
                <div className="text-left">
                  <p className="font-semibold text-sm text-violet-900">Comisión Luciana (5% sobre uniformes)</p>
                  <p className="text-xs text-violet-700/70">
                    {vistaTotales === "hoy"
                      ? "Del día de hoy"
                      : vistaTotales === "dia"
                      ? "Del " + new Date(fechaFiltro + "T00:00:00").toLocaleDateString("es-AR")
                      : vistaTotales === "30dias"
                      ? "Últimos 30 días"
                      : tituloHistorico().replace("Informe ", "")}
                    {" · incluye Cuenta Colegio"}
                  </p>
                </div>
                <span className="font-mono font-bold text-lg text-violet-800">{money(comisionLuciana)}</span>
              </button>
            )}
            {verComision && negocioId === "colegio" && (
              <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-6 flex items-center justify-between text-sm">
                <span className="text-black/50">Total vendido en Uniformes (base del cálculo)</span>
                <span className="font-mono font-semibold">{money(totalUniformesComision)}</span>
              </div>
            )}

            {resumenCategoriaVista && (
              <>
                <h2 className="font-bold mb-2 text-sm">Ventas por categoría</h2>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {CATEGORIAS.map((c) => (
                    <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-black/5">
                      <p className="text-xs text-black/40 mb-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </p>
                      <p className="font-mono font-bold text-lg">{money(resumenCategoriaVista[c.id] || 0)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h2 className="font-bold mb-2 text-sm">Detalle de ventas</h2>
            <div className="bg-white rounded-xl shadow-sm border border-black/5 divide-y divide-black/5">
              {ventasVista.length === 0 ? (
                <p className="p-4 text-sm text-black/40">
                  {vistaTotales === "hoy"
                    ? "Todavía no hay ventas hoy."
                    : vistaTotales === "dia"
                    ? "No hay ventas para esa fecha."
                    : vistaTotales === "30dias"
                    ? "No hay ventas en los últimos 30 días."
                    : "Todavía no hay ventas registradas."}
                </p>
              ) : (
                ventasVista.map((v) => (
                  <div key={v.id} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{v.items.map((i) => i.cantidad + "x " + i.nombre).join(", ")}</p>
                      <p className="text-xs text-black/40">
                        {new Date(v.fecha).toLocaleDateString("es-AR")} {new Date(v.fecha).toLocaleTimeString("es-AR")} · {labelPago(v)}
                        {" · "}
                        <span className={v.facturada ? "text-green-700" : "text-black/40"}>
                          {v.facturada ? "Facturada" : "Factura pendiente"}
                        </span>
                        {v.descuentoPct > 0 && <span className="text-red-600"> · {v.descuentoPct}% off</span>}
                      </p>
                    </div>
                    <span className="font-mono font-semibold">{money(v.total)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-black/10 no-print">
              {!confirmarReinicio ? (
                <button
                  onClick={() => setConfirmarReinicio(true)}
                  className="text-xs text-red-600 font-medium hover:underline"
                >
                  Reiniciar ventas (borra todo el historial de este negocio)
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-1">¿Seguro que querés borrar TODAS las ventas de {negocio.nombre}?</p>
                  <p className="text-xs text-red-700/70 mb-3">Esto borra el historial completo de ventas de este negocio (no afecta el stock ni la caja). No se puede deshacer.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={reiniciarVentas}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:brightness-110"
                    >
                      Sí, borrar todo
                    </button>
                    <button
                      onClick={() => setConfirmarReinicio(false)}
                      className="px-4 py-2 rounded-lg border border-black/10 text-sm text-black/60 hover:bg-black/5"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
