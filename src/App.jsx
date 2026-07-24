import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Barcode,
  CalendarDays,
  MapPin,
  Snowflake,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  X,
  Package,
  Settings,
  Save,
  FileUp,
  FileDown,
  Camera,
  Loader2,
  Store,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Info,
  LogOut,
  Minus,
  RefreshCw,
} from "lucide-react";

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load error for ${src}`));
    document.head.appendChild(script);
  });
};

const getTodayStr = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`;
};

const firebaseConfig = {
  apiKey: "AIzaSyAWjwBTH3Wsv7ZSkR73W1o8hULF5uiWIws",
  authDomain: "ikea-36103.firebaseapp.com",
  projectId: "ikea-36103",
  storageBucket: "ikea-36103.firebasestorage.app",
  messagingSenderId: "174471808960",
  appId: "1:174471808960:web:27b2c4fff31422ce1bea25",
};

const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzN9e5Oq11mW3ATcw1cam3U4Ih8PDpmIHnIlCk-x0I0kTCU77EmJgyLo1CK9Z2n-ei-4Q/exec";
const SHARED_SECRET = "IKEA_EXPIRY_SECURE_KEY_2024";

const stores = ["內湖", "新莊", "新店", "小巨蛋", "青埔", "台中", "高雄"];
const STORE_COLORS = [
  "bg-blue-50 text-blue-800 border-blue-200",
  "bg-emerald-50 text-emerald-800 border-emerald-200",
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-rose-50 text-rose-800 border-rose-200",
  "bg-purple-50 text-purple-800 border-purple-200",
  "bg-cyan-50 text-cyan-800 border-cyan-200",
  "bg-orange-50 text-orange-800 border-orange-200",
];

export default function ExpiryManager() {
  const [db, setDb] = useState(null);
  const [useLocalMode, setUseLocalMode] = useState(true);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [auth, setAuth] = useState({ store: null, role: null, password: "" });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(true);
  const [storePasswords, setStorePasswords] = useState({});
  const [staffPasswords, setStaffPasswords] = useState({});

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_group");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [newLocationInput, setNewLocationInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [newStaffPwdInput, setNewStaffPwdInput] = useState("");
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [selectedIds, setSelectedIds] = useState(new Set());

  const defaultForm = {
    barcode: "",
    name: "",
    category: "room_temp",
    location: "",
    receiveDate: getTodayStr(),
    expiryDate: "",
    quantity: 1,
    isSoldOut: false,
    reminderDays: 60,
    hasSecondReminder: false,
    reminderDays2: 14,
  };
  const [formData, setFormData] = useState(defaultForm);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState("form");
  const scannerRef = useRef(null);

  useEffect(() => {
    const loadLibs = async () => {
      try {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
        );
        await loadScript("https://unpkg.com/html5-qrcode");
        await loadScript(
          "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"
        );
        await loadScript(
          "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"
        );
        await loadScript(
          "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"
        );
        setLibrariesLoaded(true);
      } catch (e) {
        showToast("載入外部套件失敗，請檢查網路連線", "error");
      }
    };
    loadLibs();
  }, []);

  const loadLocalData = (storeName) => {
    setUseLocalMode(true);
    const localProducts =
      JSON.parse(localStorage.getItem(`expiry_products_${storeName}`)) || [];
    const localSettings = JSON.parse(
      localStorage.getItem(`expiry_manager_settings_${storeName}`)
    ) || { locations: ["倉庫A", "展示架", "冷藏室", "冷凍庫"] };
    setProducts(localProducts);
    setLocations(localSettings.locations);

    if (localSettings.customPassword) {
      setStorePasswords((prev) => ({
        ...prev,
        [storeName]: localSettings.customPassword,
      }));
    }
    if (localSettings.staffPassword) {
      setStaffPasswords((prev) => ({
        ...prev,
        [storeName]: localSettings.staffPassword,
      }));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!librariesLoaded || !auth.store) return;
    setLoading(true);
    if (!firebaseConfig.apiKey) return loadLocalData(auth.store);

    try {
      if (!window.firebase.apps.length)
        window.firebase.initializeApp(firebaseConfig);
      const firestoreDb = window.firebase.firestore();
      const firebaseAuth = window.firebase.auth();

      firebaseAuth.signInAnonymously().then(() => {
        setDb(firestoreDb);
        setUseLocalMode(false);
        const unsubscribeProducts = firestoreDb
          .collection("stores")
          .doc(auth.store)
          .collection("products")
          .onSnapshot(
            (snapshot) => {
              const productsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              setProducts(productsData);
              setLoading(false);
            },
            () => loadLocalData(auth.store)
          );
        const unsubscribeSettings = firestoreDb
          .collection("stores")
          .doc(auth.store)
          .collection("settings")
          .doc("config")
          .onSnapshot((docSnap) => {
            if (docSnap.exists) {
              const data = docSnap.data();
              setLocations(
                data.locations || ["倉庫A", "展示架", "冷藏室", "冷凍庫"]
              );
              if (data.customPassword)
                setStorePasswords((prev) => ({
                  ...prev,
                  [auth.store]: data.customPassword,
                }));
              if (data.staffPassword)
                setStaffPasswords((prev) => ({
                  ...prev,
                  [auth.store]: data.staffPassword,
                }));
            } else {
              setLocations(["倉庫A", "展示架", "冷藏室", "冷凍庫"]);
            }
          });
        return () => {
          unsubscribeProducts();
          unsubscribeSettings();
        };
      });
    } catch (error) {
      loadLocalData(auth.store);
    }
  }, [librariesLoaded, auth.store]);

  useEffect(() => {
    if (formData.barcode && !editingId) {
      const localMatch = products.find(
        (p) =>
          String(p.barcode).toLowerCase() ===
          String(formData.barcode).toLowerCase()
      );
      if (localMatch) {
        setFormData((prev) => ({
          ...prev,
          name: prev.name || localMatch.name,
          category: localMatch.category,
          location: prev.location || localMatch.location,
          reminderDays: localMatch.reminderDays || 60,
          hasSecondReminder: localMatch.hasSecondReminder || false,
          reminderDays2: localMatch.reminderDays2 || 14,
        }));
        return;
      }
      if (!useLocalMode && db) {
        const safeId = formData.barcode.replace(/\//g, "_");
        db.collection("master_products")
          .doc(safeId)
          .get()
          .then((docSnap) => {
            if (docSnap.exists) {
              const master = docSnap.data();
              setFormData((prev) => ({
                ...prev,
                name: prev.name || master.name,
                category: master.category || prev.category,
                reminderDays: master.reminderDays || 60,
                hasSecondReminder: master.hasSecondReminder || false,
                reminderDays2: master.reminderDays2 || 14,
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, [formData.barcode, db, useLocalMode, editingId, products]);

  const showToast = (message, type = "info") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };
  const confirmAction = (message, onConfirm) =>
    setConfirmDialog({ message, onConfirm });

  const handleLogin = (e) => {
    e.preventDefault();
    const inputPwd = auth.password;
    const customAdminPwd = storePasswords[auth.store] || "8888";
    const customStaffPwd = staffPasswords[auth.store] || "1234";

    if (inputPwd === customAdminPwd) {
      setAuth((prev) => ({ ...prev, role: "admin" }));
      setIsLoginModalOpen(false);
      showToast(`登入成功：${auth.store} (管理者)`, "success");
    } else if (inputPwd === customStaffPwd) {
      setAuth((prev) => ({ ...prev, role: "staff" }));
      setIsLoginModalOpen(false);
      showToast(`登入成功：${auth.store} (一般帳號)`, "success");
    } else {
      showToast("密碼錯誤，請重試", "error");
    }
  };

  const handleLogout = () => {
    setAuth({ store: null, role: null, password: "" });
    setIsLoginModalOpen(true);
  };

  const getExpiryStatus = (
    expiryDate,
    reminderDays = 60,
    hasSecondReminder = false,
    reminderDays2 = 14
  ) => {
    const today = new Date(getTodayStr());
    const expDate = new Date(expiryDate);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    const dangerThreshold = hasSecondReminder
      ? reminderDays2
      : Math.ceil(reminderDays / 2);

    if (diffDays < 0)
      return {
        status: "expired",
        label: "已過期",
        color: "text-red-600",
        bg: "bg-red-50",
        bgBar: "bg-red-400",
        border: "border-red-200",
        days: Math.abs(diffDays),
      };
    if (diffDays <= dangerThreshold)
      return {
        status: "danger",
        label: "高度警戒",
        color: "text-red-600",
        bg: "bg-red-50",
        bgBar: "bg-red-400",
        border: "border-red-200",
        days: diffDays,
      };
    if (diffDays <= reminderDays)
      return {
        status: "warning",
        label: "中度警戒",
        color: "text-orange-600",
        bg: "bg-orange-50",
        bgBar: "bg-orange-400",
        border: "border-orange-200",
        days: diffDays,
      };
    return {
      status: "safe",
      label: "安全無虞",
      color: "text-green-600",
      bg: "bg-green-50",
      bgBar: "bg-green-400",
      border: "border-green-200",
      days: diffDays,
    };
  };

  const syncSnapshotToGoogleSheets = async (productsToSync) => {
    const activeProducts = productsToSync.filter(
      (p) => !p.isSoldOut && p.quantity > 0
    );
    const payload = {
      secret: SHARED_SECRET,
      action: "bulk_sync",
      store: auth.store,
      items: activeProducts.map((p) => ({
        name: p.name,
        barcode: p.barcode || "",
        category: p.category || "room_temp",
        expiryDate: p.expiryDate,
        receiveDate: p.receiveDate || "",
        store: auth.store,
        quantity: p.quantity,
        location: p.location || "未指定",
        reminderDays: p.reminderDays !== undefined ? p.reminderDays : 60,
        hasSecondReminder: p.hasSecondReminder || false,
        reminderDays2: p.reminderDays2 !== undefined ? p.reminderDays2 : 14,
      })),
    };
    try {
      await fetch(GAS_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    } catch (err) {}
  };

  const handleBulkSyncToSheet = async () => {
    if (auth.role !== "admin") return;
    setIsSyncing(true);
    showToast("開始同步，請稍候...", "info");
    await syncSnapshotToGoogleSheets(products);
    showToast("整店庫存已完美覆蓋同步至試算表！", "success");
    setIsSyncing(false);
  };

  // 💡 僅加入「連續對焦」的掃描優化
  const handleStartScanner = (target) => {
    if (!window.Html5Qrcode)
      return showToast("掃描套件載入中，請稍後", "warning");
    setScannerTarget(target);
    setIsScannerOpen(true);
    setTimeout(() => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const boxWidth = Math.min(window.innerWidth - 40, 300);
        const boxHeight = Math.floor(boxWidth * 0.6);
        html5QrCode
          .start(
            { 
              facingMode: "environment",
              advanced: [{ focusMode: "continuous" }] // 💡 強制喚醒手機硬體的連續對焦
            },
            { 
              fps: 30, 
              qrbox: { width: boxWidth, height: boxHeight }
            },
            (decodedText) => {
              if (target === "form")
                setFormData((prev) => ({ ...prev, barcode: decodedText }));
              else if (target === "search") setSearchQuery(decodedText);
              handleStopScanner();
            },
            () => {}
          )
          .catch(() => {
            showToast("無法啟動相機", "error");
            handleStopScanner();
          });
      } catch (err) {
        handleStopScanner();
      }
    }, 300);
  };

  const handleStopScanner = () => {
    setIsScannerOpen(false);
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current.clear();
          scannerRef.current = null;
        })
        .catch(() => {});
    }
  };

  const handleEdit = (product) => {
    setFormData(product);
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(defaultForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentUserRole = auth.role === "admin" ? "管理" : "一般";

    const isLocationChanged = editingId
      ? formData.location !== products.find(p => p.id === editingId)?.location
      : true;

    const dataToSave = {
      ...formData,
      name: formData.name.trim(),
      barcode: String(formData.barcode).trim(),
      quantity: Number(formData.quantity),
      reminderDays: Number(formData.reminderDays),
      reminderDays2: Number(formData.reminderDays2),
      updatedAt: new Date().toISOString(),
      locationUpdatedAt: isLocationChanged
        ? new Date().toISOString()
        : (products.find(p => p.id === editingId)?.locationUpdatedAt || new Date().toISOString()),
      lastUpdatedBy: currentUserRole,
    };

    if (dataToSave.quantity <= 0) {
      dataToSave.isSoldOut = true;
    } else {
      dataToSave.isSoldOut = false;
    }

    let updatedProducts = [...products];

    if (useLocalMode) {
      if (editingId) {
        updatedProducts = updatedProducts.map((p) =>
          p.id === editingId ? { ...dataToSave, id: editingId } : p
        );
      } else {
        const existingIdx = updatedProducts.findIndex(
          (p) =>
            String(p.barcode).toLowerCase() ===
              String(dataToSave.barcode).toLowerCase() &&
            p.name === dataToSave.name &&
            p.expiryDate === dataToSave.expiryDate &&
            p.location === dataToSave.location
        );
        if (existingIdx >= 0) {
          updatedProducts[existingIdx].quantity += dataToSave.quantity;
          updatedProducts[existingIdx].isSoldOut = false;
          updatedProducts[existingIdx].updatedAt = dataToSave.updatedAt;
          updatedProducts[existingIdx].lastUpdatedBy = dataToSave.lastUpdatedBy;
        } else {
          updatedProducts.push({ ...dataToSave, id: Date.now().toString() });
        }
      }
      setProducts(updatedProducts);
      localStorage.setItem(
        `expiry_products_${auth.store}`,
        JSON.stringify(updatedProducts)
      );
      syncSnapshotToGoogleSheets(updatedProducts);
    } else if (db && auth.store) {
      const batch = db.batch();
      if (editingId) {
        batch.update(
          db
            .collection("stores")
            .doc(auth.store)
            .collection("products")
            .doc(editingId),
          dataToSave
        );
        updatedProducts = updatedProducts.map((p) =>
          p.id === editingId ? { ...dataToSave, id: editingId } : p
        );
      } else {
        const existingIdx = products.findIndex(
          (p) =>
            String(p.barcode).toLowerCase() ===
              String(dataToSave.barcode).toLowerCase() &&
            p.name === dataToSave.name &&
            p.expiryDate === dataToSave.expiryDate &&
            p.location === dataToSave.location
        );
        if (existingIdx >= 0) {
          const newQty = products[existingIdx].quantity + dataToSave.quantity;
          batch.update(
            db
              .collection("stores")
              .doc(auth.store)
              .collection("products")
              .doc(products[existingIdx].id),
            {
              quantity: newQty,
              isSoldOut: false,
              updatedAt: dataToSave.updatedAt,
              lastUpdatedBy: dataToSave.lastUpdatedBy,
            }
          );
          updatedProducts[existingIdx] = {
            ...updatedProducts[existingIdx],
            quantity: newQty,
            isSoldOut: false,
            updatedAt: dataToSave.updatedAt,
            lastUpdatedBy: dataToSave.lastUpdatedBy,
          };
        } else {
          const newRef = db
            .collection("stores")
            .doc(auth.store)
            .collection("products")
            .doc();
          batch.set(newRef, dataToSave);
          updatedProducts.push({ ...dataToSave, id: newRef.id });
        }
      }
      if (dataToSave.barcode) {
        batch.set(
          db
            .collection("master_products")
            .doc(dataToSave.barcode.replace(/\//g, "_")),
          {
            name: dataToSave.name,
            category: dataToSave.category,
            reminderDays: dataToSave.reminderDays,
            hasSecondReminder: dataToSave.hasSecondReminder,
            reminderDays2: dataToSave.reminderDays2,
            updatedAt: dataToSave.updatedAt,
          },
          { merge: true }
        );
      }
      await batch.commit();
      syncSnapshotToGoogleSheets(updatedProducts);
    }
    showToast(editingId ? "修改成功" : "新增成功", "success");
    closeModal();
  };

  const handleQuantityMinus = async (product) => {
    const currentQty = Number(product.quantity);
    if (isNaN(currentQty) || currentQty <= 1) return handleMarkSoldOut(product);

    const currentUserRole = auth.role === "admin" ? "管理" : "一般";
    const updatedProduct = { 
      ...product, 
      quantity: currentQty - 1,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: currentUserRole
    };
    
    let newProductsList = products.map((p) =>
      p.id === product.id ? updatedProduct : p
    );

    if (useLocalMode) {
      setProducts(newProductsList);
      localStorage.setItem(
        `expiry_products_${auth.store}`,
        JSON.stringify(newProductsList)
      );
      syncSnapshotToGoogleSheets(newProductsList);
    } else if (db) {
      await db
        .collection("stores")
        .doc(auth.store)
        .collection("products")
        .doc(product.id)
        .update({ 
          quantity: currentQty - 1,
          updatedAt: updatedProduct.updatedAt,
          lastUpdatedBy: updatedProduct.lastUpdatedBy
        });
      syncSnapshotToGoogleSheets(newProductsList);
    }
  };

  const handleMarkSoldOut = async (product) => {
    const currentUserRole = auth.role === "admin" ? "管理" : "一般";
    const updatedProduct = { 
      ...product, 
      isSoldOut: true,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: currentUserRole
    };

    let newProductsList = products.map((p) =>
      p.id === product.id ? updatedProduct : p
    );

    if (useLocalMode) {
      setProducts(newProductsList);
      localStorage.setItem(
        `expiry_products_${auth.store}`,
        JSON.stringify(newProductsList)
      );
      syncSnapshotToGoogleSheets(newProductsList);
    } else if (db) {
      await db
        .collection("stores")
        .doc(auth.store)
        .collection("products")
        .doc(product.id)
        .update({ 
          isSoldOut: true,
          updatedAt: updatedProduct.updatedAt,
          lastUpdatedBy: updatedProduct.lastUpdatedBy
        });
      syncSnapshotToGoogleSheets(newProductsList);
    }
    showToast(`「${product.name}」已標記為賣完`, "success");
  };

  const handleDelete = (id) => {
    if (auth.role !== "admin")
      return showToast("權限不足：僅管理者可刪除", "error");
    confirmAction("確定要刪除這筆庫存嗎？", async () => {
      let updatedProducts = products.filter((p) => p.id !== id);
      if (useLocalMode) {
        setProducts(updatedProducts);
        localStorage.setItem(
          `expiry_products_${auth.store}`,
          JSON.stringify(updatedProducts)
        );
      } else if (db) {
        await db
          .collection("stores")
          .doc(auth.store)
          .collection("products")
          .doc(id)
          .delete();
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      syncSnapshotToGoogleSheets(updatedProducts);
      showToast("商品已刪除");
    });
  };

  const handleBulkDelete = () => {
    if (auth.role !== "admin") return showToast("權限不足", "error");
    if (selectedIds.size === 0) return;
    confirmAction(
      `確定要刪除選取的 ${selectedIds.size} 筆庫存嗎？`,
      async () => {
        let updatedProducts = products.filter((p) => !selectedIds.has(p.id));
        if (useLocalMode) {
          setProducts(updatedProducts);
          localStorage.setItem(
            `expiry_products_${auth.store}`,
            JSON.stringify(updatedProducts)
          );
        } else if (db) {
          const batch = db.batch();
          selectedIds.forEach((id) => {
            batch.delete(
              db
                .collection("stores")
                .doc(auth.store)
                .collection("products")
                .doc(id)
            );
          });
          await batch.commit();
        }
        setSelectedIds(new Set());
        syncSnapshotToGoogleSheets(updatedProducts);
        showToast(`成功刪除 ${selectedIds.size} 筆商品`);
      }
    );
  };

  const formatExcelDate = (val) => {
    if (!val) return "";
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return "";
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(val.getDate()).padStart(2, "0")}`;
    }
    if (typeof val === "number") {
      if (val > 10000000) {
        const strVal = String(val);
        return `${strVal.substring(0, 4)}-${strVal.substring(
          4,
          6
        )}-${strVal.substring(6, 8)}`;
      }
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    }
    let str = String(val)
      .trim()
      .replace(/[/.]/g, "-")
      .replace(/[\u4e00-\u9fa5]/g, "");
    const match = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match)
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(
        2,
        "0"
      )}`;
    const match8 = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match8) return `${match8[1]}-${match8[2]}-${match8[3]}`;
    return "";
  };

  const handleExcelExport = () => {
    if (!window.XLSX) return showToast("Excel 套件載入中", "warning");
    if (auth.role !== "admin") return showToast("僅管理者可匯出資料", "error");
    if (products.length === 0) return showToast("目前沒有資料", "warning");

    const exportData = products.map((p) => ({
      貨號: p.barcode,
      商品名稱: p.name,
      溫層: p.category === "frozen" ? "冷凍" : "常溫",
      存放地點: p.location || "",
      數量: p.quantity,
      狀態: p.isSoldOut || p.quantity <= 0 ? "已售完" : "架上",
      進貨日期: p.receiveDate,
      有效期限: p.expiryDate,
      提醒天數: p.reminderDays,
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "庫存報表");
    window.XLSX.writeFile(wb, `${auth.store}_庫存報表_${getTodayStr()}.xlsx`);
    showToast("匯出成功", "success");
  };

  const handleExcelImport = async (e) => {
    if (!window.XLSX) return showToast("Excel 套件載入中", "warning");
    if (auth.role !== "admin") return showToast("僅管理者可匯入資料", "error");
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);

    let defaultReceiveDate = getTodayStr();
    const filenameMatch = file.name.match(
      /(\d{4}-\d{2}-\d{2})|(?:\D|^)(\d{4})(?:\D|$)/
    );
    if (filenameMatch) {
      if (filenameMatch[1]) {
        defaultReceiveDate = filenameMatch[1];
      } else if (filenameMatch[2]) {
        const month = filenameMatch[2].substring(0, 2);
        const day = filenameMatch[2].substring(2, 4);
        const currentYear = new Date().getFullYear();
        if (
          parseInt(month) >= 1 &&
          parseInt(month) <= 12 &&
          parseInt(day) >= 1 &&
          parseInt(day) <= 31
        ) {
          defaultReceiveDate = `${currentYear}-${month}-${day}`;
          showToast(`已自動從檔名帶入進貨日期：${defaultReceiveDate}`);
        }
      }
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = window.XLSX.read(bstr, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = window.XLSX.utils.sheet_to_json(ws);

        const newProducts = [];
        let skippedCount = 0;
        const currentUserRole = auth.role === "admin" ? "管理" : "一般";

        for (const row of data) {
          let rawQuantity =
            row["數量(最小單位)"] ||
            row["數量"] ||
            row["庫存"] ||
            row["Qty"] ||
            1;
          let isSoldOut = false;
          if (
            String(rawQuantity).trim() === "已賣完" ||
            Number(rawQuantity) <= 0
          ) {
            isSoldOut = true;
            rawQuantity = Number(rawQuantity) || 0;
          } else {
            rawQuantity = Number(rawQuantity);
          }

          const name = String(
            row["商品名稱"] || row["品名"] || row["名稱"] || "未命名"
          ).trim();
          const rawBarcode =
            row["貨號"] || row["商品條碼"] || row["條碼"] || "";
          const barcode = rawBarcode ? String(rawBarcode).trim() : name;

          let category = "room_temp";
          let rDays = 60,
            hasRem2 = false,
            rDays2 = 14;

          if (String(row["溫層"] || row["分類"] || "").includes("冷凍"))
            category = "frozen";

          const localMatch = products.find(
            (p) => String(p.barcode).toLowerCase() === barcode.toLowerCase()
          );
          if (localMatch) {
            category = localMatch.category;
            rDays = localMatch.reminderDays || 60;
            hasRem2 = localMatch.hasSecondReminder || false;
            rDays2 = localMatch.reminderDays2 || 14;
          } else if (!useLocalMode && db) {
            const safeId = barcode.replace(/\//g, "_");
            try {
              const docSnap = await db
                .collection("master_products")
                .doc(safeId)
                .get();
              if (docSnap.exists) {
                const master = docSnap.data();
                category = master.category || category;
                rDays = master.reminderDays || 60;
                hasRem2 = master.hasSecondReminder || false;
                rDays2 = master.reminderDays2 || 14;
              }
            } catch (e) {}
          }

          const expiryRaw =
            row["有效期限"] || row["到期日"] || row["到期日期"] || row["效期"];
          const parsedExpiry = formatExcelDate(expiryRaw);

          if (!name || !parsedExpiry) {
            skippedCount++;
            continue;
          }

          newProducts.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            barcode: barcode,
            name: name,
            category: category,
            location: String(
              row["存放地點"] || row["地點"] || row["儲位"] || ""
            ),
            receiveDate:
              formatExcelDate(row["進貨日"] || row["進貨日期"]) ||
              defaultReceiveDate,
            expiryDate: parsedExpiry,
            quantity: rawQuantity,
            isSoldOut: isSoldOut,
            reminderDays: Number(row["提醒天數"] || rDays),
            hasSecondReminder: hasRem2,
            reminderDays2: rDays2,
            updatedAt: new Date().toISOString(),
            locationUpdatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUserRole,
          });
        }

        let updatedProducts = [...products];
        const mergedExistingProducts = {};
        const finalNewProducts = [];

        newProducts.forEach((newProd) => {
          const existingIdx = updatedProducts.findIndex(
            (p) =>
              String(p.barcode).toLowerCase() ===
                String(newProd.barcode).toLowerCase() &&
              p.name === newProd.name &&
              p.expiryDate === newProd.expiryDate &&
              p.location === newProd.location
          );
          if (existingIdx >= 0) {
            const mergedQty =
              (Number(updatedProducts[existingIdx].quantity) || 0) +
              (Number(newProd.quantity) || 0);
            updatedProducts[existingIdx].quantity = mergedQty;
            updatedProducts[existingIdx].isSoldOut = mergedQty <= 0;
            updatedProducts[existingIdx].updatedAt = new Date().toISOString();
            updatedProducts[existingIdx].lastUpdatedBy = currentUserRole;
            
            mergedExistingProducts[updatedProducts[existingIdx].id] =
              updatedProducts[existingIdx];
          } else {
            updatedProducts.push(newProd);
            finalNewProducts.push(newProd);
          }
        });

        if (useLocalMode) {
          setProducts(updatedProducts);
          localStorage.setItem(
            `expiry_products_${auth.store}`,
            JSON.stringify(updatedProducts)
          );
        } else if (db && auth.store) {
          const batch = db.batch();
          for (const prod of finalNewProducts)
            batch.set(
              db
                .collection("stores")
                .doc(auth.store)
                .collection("products")
                .doc(prod.id),
              prod
            );
          for (const id in mergedExistingProducts)
            batch.update(
              db
                .collection("stores")
                .doc(auth.store)
                .collection("products")
                .doc(id),
              {
                quantity: mergedExistingProducts[id].quantity,
                isSoldOut: mergedExistingProducts[id].isSoldOut,
                updatedAt: mergedExistingProducts[id].updatedAt,
                lastUpdatedBy: mergedExistingProducts[id].lastUpdatedBy,
              }
            );
          await batch.commit();
        }

        syncSnapshotToGoogleSheets(updatedProducts);
        showToast(
          `匯入完成！成功：${newProducts.length} 筆，略過：${skippedCount} 筆(無效期/名稱)`,
          "success"
        );
      } catch (error) {
        showToast("匯入失敗，請確認檔案格式", "error");
      } finally {
        setIsImporting(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  let filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      String(p.barcode).toLowerCase().includes(q);

    if (!matchSearch) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterLocation !== "all" && p.location !== filterLocation) return false;

    const isActuallySoldOut = p.isSoldOut || p.quantity <= 0;

    if (filterStatus === "sold_out") return isActuallySoldOut;
    if (isActuallySoldOut) return false;

    if (filterStatus !== "all") {
      const st = getExpiryStatus(
        p.expiryDate,
        p.reminderDays,
        p.hasSecondReminder,
        p.reminderDays2
      );
      if (
        filterStatus === "warning" &&
        st.status !== "danger" &&
        st.status !== "warning"
      )
        return false;
      if (filterStatus === "expired" && st.status !== "expired") return false;
    }
    return true;
  });

  const groups = {};
  filteredProducts.forEach((p) => {
    const key = `${String(p.barcode).trim().toLowerCase()}_${String(
      p.name
    ).trim()}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        name: p.name,
        barcode: p.barcode,
        category: p.category,
        totalQuantity: 0,
        earliestExpiry: null,
        batches: [],
      };
    }
    if (!p.isSoldOut && p.quantity > 0) {
      groups[key].totalQuantity += Number(p.quantity) || 0;
    }
    groups[key].batches.push(p);
  });

  let displayList = Object.values(groups).map((g) => {
    g.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    if (g.batches.length > 0)
      g.earliestExpiry = new Date(g.batches[0].expiryDate).getTime();
    else g.earliestExpiry = Infinity;
    return g;
  });

  displayList.sort((a, b) => {
    let result = 0;
    if (sortBy === "expiry")
      result = (a.earliestExpiry || 0) - (b.earliestExpiry || 0);
    else if (sortBy === "quantity") result = a.totalQuantity - b.totalQuantity;
    else result = a.name.localeCompare(b.name, "zh-TW");
    return sortOrder === "asc" ? result : -result;
  });

  const totalPages = Math.max(1, Math.ceil(displayList.length / itemsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);
  const paginatedList = displayList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const currentDisplayIds = paginatedList.flatMap((g) =>
    g.batches.map((b) => b.id)
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === currentDisplayIds.length)
      setSelectedIds(new Set());
    else setSelectedIds(new Set(currentDisplayIds));
  };

  const fifoIds = new Set();
  const barcodeEarliest = {}; 

  products.forEach((p) => {
    if (p.isSoldOut || p.quantity <= 0) return;
    const diff = Math.ceil(
      (new Date(p.expiryDate) - new Date(getTodayStr())) / (1000 * 60 * 60 * 24)
    );
    
    if (diff >= 0) {
      const barcodeKey = String(p.barcode).trim().toLowerCase();
      const current = barcodeEarliest[barcodeKey];

      const pExpiryTime = new Date(p.expiryDate).getTime();
      const pReceiveTime = new Date(p.receiveDate || getTodayStr()).getTime();

      if (!current) {
        barcodeEarliest[barcodeKey] = {
          id: p.id,
          expiryTime: pExpiryTime,
          receiveTime: pReceiveTime,
        };
      } else {
        if (pExpiryTime < current.expiryTime) {
          barcodeEarliest[barcodeKey] = {
            id: p.id,
            expiryTime: pExpiryTime,
            receiveTime: pReceiveTime,
          };
        } else if (pExpiryTime === current.expiryTime) {
          if (pReceiveTime < current.receiveTime) {
            barcodeEarliest[barcodeKey] = {
              id: p.id,
              expiryTime: pExpiryTime,
              receiveTime: pReceiveTime,
            };
          }
        }
      }
    }
  });

  Object.values(barcodeEarliest).forEach((item) => fifoIds.add(item.id));

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++)
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      const dayProducts = products.filter(
        (p) => p.expiryDate === dateStr && !p.isSoldOut && p.quantity > 0
      );
      const isSelected = selectedCalendarDay === dateStr;

      let dotColor = "bg-[#0058a3]";
      if (dayProducts.length > 0) {
        const statuses = dayProducts.map(
          (p) =>
            getExpiryStatus(
              p.expiryDate,
              p.reminderDays,
              p.hasSecondReminder,
              p.reminderDays2
            ).status
        );
        if (statuses.includes("expired") || statuses.includes("danger"))
          dotColor = "bg-red-500";
        else if (statuses.includes("warning")) dotColor = "bg-orange-500";
      }

      days.push(
        <button
          key={d}
          onClick={() => setSelectedCalendarDay(dateStr)}
          className={`p-2 border rounded-xl flex flex-col items-center justify-start h-14 relative transition ${
            isSelected
              ? "ring-2 ring-[#0058a3] bg-blue-50"
              : "bg-white hover:bg-gray-50 border-gray-200"
          } ${
            dateStr === getTodayStr()
              ? "border-[#FBD914] border-2 font-bold"
              : ""
          }`}
        >
          <span className="text-sm">{d}</span>
          {dayProducts.length > 0 && (
            <div className={`w-2 h-2 rounded-full mt-1 ${dotColor}`}></div>
          )}
        </button>
      );
    }
    return days;
  };

  if (isLoginModalOpen) {
    return (
      <div className="min-h-screen bg-[#0058a3] flex flex-col items-center justify-center p-4 relative">
        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border-b-8 border-[#FBD914] z-10 mb-8">
          <div className="p-8 text-center bg-white">
            <h1 className="text-2xl font-black text-[#0058a3] tracking-wider mb-6 flex items-center justify-center gap-2">
              <Package className="w-8 h-8 text-[#FBD914]" /> 向即期品說再見
            </h1>
            {!auth.store ? (
              <div className="grid grid-cols-2 gap-3">
                {stores.map((store, i) => (
                  <button
                    key={store}
                    onClick={() => setAuth((prev) => ({ ...prev, store }))}
                    className={`p-3 border-2 rounded-2xl font-bold text-lg transition-transform active:scale-95 ${
                      STORE_COLORS[i % STORE_COLORS.length]
                    }`}
                  >
                    {store}
                  </button>
                ))}
              </div>
            ) : (
              <form
                onSubmit={handleLogin}
                className="space-y-4 animate-in fade-in"
              >
                <div className="flex justify-between items-center mb-4">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-gray-400 text-sm"
                  >
                    <ChevronLeft className="w-4 h-4 inline" /> 更換
                  </button>
                  <span className="font-bold text-[#0058a3] bg-blue-50 px-3 py-1 rounded">
                    {auth.store}店
                  </span>
                </div>
                <input
                  type="password"
                  placeholder="輸入密碼..."
                  required
                  value={auth.password}
                  onChange={(e) =>
                    setAuth((prev) => ({ ...prev, password: e.target.value }))
                  }
                  className="w-full px-4 py-4 border-2 rounded-2xl font-bold text-center text-lg outline-none focus:border-[#0058a3] bg-gray-50 transition"
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full py-4 bg-[#0058a3] text-[#FBD914] font-black rounded-xl text-lg hover:bg-[#004a89] transition shadow-md"
                >
                  登 入
                </button>
              </form>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-4 sm:bottom-6 w-full text-center flex flex-col gap-1 text-white/70 text-xs font-bold tracking-widest z-10">
          <span>&copy; {new Date().getFullYear()} 向即期品說再見. All rights reserved.</span>
          <span className="text-[10px] text-white/50">Designed by NHS Peter Chen (Yow-Tyng Chen)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 relative overflow-x-hidden">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-5">
          {toastMessage.type === "error" ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          )}
          <span className="font-medium text-sm tracking-wide">
            {toastMessage.message}
          </span>
        </div>
      )}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border-t-8 border-[#0058a3]">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Info className="w-6 h-6 text-[#0058a3]" /> 系統提示
            </h3>
            <p className="text-slate-600 mb-6 font-medium">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 font-bold text-slate-600"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0058a3] text-white font-bold"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center">
          <button
            onClick={handleStopScanner}
            className="absolute top-6 right-6 z-10 bg-white/20 p-3 rounded-full text-white"
          >
            <X className="w-8 h-8" />
          </button>
          <div
            id="reader"
            className="w-full max-w-sm bg-gray-900 overflow-hidden shadow-2xl rounded-2xl border-4 border-[#FBD914]"
          ></div>
          <p className="text-white mt-8 font-bold tracking-widest animate-pulse flex items-center gap-2">
            <Camera className="w-5 h-5" /> 請對準條碼
          </p>
        </div>
      )}

      <header className="bg-[#0058a3] shadow-md sticky top-0 z-30 border-b-[6px] border-[#FBD914] py-4 px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Package className="w-10 h-10 text-[#FBD914] drop-shadow-md" />
          <div>
            <h1 className="font-black text-xl text-white tracking-wider">
              向即期品說再見
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-bold">
                {auth.store}店 ({auth.role === "admin" ? "管理" : "一般"})
              </span>
              <button
                onClick={handleLogout}
                className="text-white/70 hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => setIsCalendarOpen(true)}
            className="p-2.5 bg-white/10 text-white rounded-xl flex items-center justify-center"
          >
            <CalendarDays className="w-5 h-5" />
          </button>
          {auth.role === "admin" && (
            <>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 bg-white/10 text-white rounded-xl flex items-center justify-center"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleExcelExport}
                className="p-2.5 bg-white/10 text-white rounded-xl flex items-center justify-center"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <label className="p-2.5 bg-white/10 text-white rounded-xl cursor-pointer flex items-center justify-center">
                {isImporting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FileUp className="w-5 h-5" />
                )}
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleExcelImport}
                />
              </label>
            </>
          )}
          <button
            onClick={() => {
              setFormData(defaultForm);
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#FBD914] text-[#0058a3] rounded-xl font-black flex items-center gap-1 shadow-lg border-b-4 border-[#d4b50d] active:border-b-0"
          >
            <Plus className="w-5 h-5" /> 新增商品
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div
          className={`grid ${
            auth.role === "admin" ? "grid-cols-4" : "grid-cols-3"
          } gap-2 mb-5`}
        >
          <div
            onClick={() => {
              setFilterStatus("all");
              setCurrentPage(1);
            }}
            className={`cursor-pointer transition p-2 rounded-xl border-2 flex flex-col items-center justify-center shadow-sm ${
              filterStatus === "all"
                ? "bg-[#0058a3] border-[#0058a3] text-white"
                : "bg-white border-gray-200 text-slate-700"
            }`}
          >
            <span className="text-xl font-black">
              {products.filter((p) => !p.isSoldOut && p.quantity > 0).length}
            </span>
            <span className="text-[10px] font-bold">全部商品</span>
          </div>
          <div
            onClick={() => {
              setFilterStatus("warning");
              setCurrentPage(1);
            }}
            className={`cursor-pointer transition p-2 rounded-xl border-2 flex flex-col items-center justify-center shadow-sm ${
              filterStatus === "warning"
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-orange-50 border-orange-200 text-orange-700"
            }`}
          >
            <span className="text-xl font-black">
              {
                products.filter(
                  (p) =>
                    !p.isSoldOut &&
                    p.quantity > 0 &&
                    (getExpiryStatus(
                      p.expiryDate,
                      p.reminderDays,
                      p.hasSecondReminder,
                      p.reminderDays2
                    ).status === "danger" ||
                      getExpiryStatus(
                        p.expiryDate,
                        p.reminderDays,
                        p.hasSecondReminder,
                        p.reminderDays2
                      ).status === "warning")
                ).length
              }
            </span>
            <span className="text-[10px] font-bold">近期警戒</span>
          </div>
          <div
            onClick={() => {
              setFilterStatus("expired");
              setCurrentPage(1);
            }}
            className={`cursor-pointer transition p-2 rounded-xl border-2 flex flex-col items-center justify-center shadow-sm ${
              filterStatus === "expired"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-red-50 border-red-200 text-red-600"
            }`}
          >
            <span className="text-xl font-black">
              {
                products.filter(
                  (p) =>
                    !p.isSoldOut &&
                    p.quantity > 0 &&
                    getExpiryStatus(
                      p.expiryDate,
                      p.reminderDays,
                      p.hasSecondReminder,
                      p.reminderDays2
                    ).status === "expired"
                ).length
              }
            </span>
            <span className="text-[10px] font-bold">已過期</span>
          </div>
          {auth.role === "admin" && (
            <div
              onClick={() => {
                setFilterStatus("sold_out");
                setCurrentPage(1);
              }}
              className={`cursor-pointer transition p-2 rounded-xl border-2 flex flex-col items-center justify-center shadow-sm ${
                filterStatus === "sold_out"
                  ? "bg-gray-600 border-gray-600 text-white"
                  : "bg-gray-100 border-gray-200 text-gray-600"
              }`}
            >
              <span className="text-xl font-black">
                {products.filter((p) => p.isSoldOut || p.quantity <= 0).length}
              </span>
              <span className="text-[10px] font-bold">已售完清單</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-2 bg-gray-200 p-1.5 rounded-xl w-full overflow-x-auto custom-scrollbar">
            <button
              onClick={() => {
                setFilterCategory("all");
                setCurrentPage(1);
              }}
              className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg ${
                filterCategory === "all"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              全部
            </button>
            <button
              onClick={() => {
                setFilterCategory("room_temp");
                setCurrentPage(1);
              }}
              className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-1 ${
                filterCategory === "room_temp"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <Sun className="w-4 h-4" /> 常溫
            </button>
            <button
              onClick={() => {
                setFilterCategory("frozen");
                setCurrentPage(1);
              }}
              className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-1 ${
                filterCategory === "frozen"
                  ? "bg-white text-[#0058a3] shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <Snowflake className="w-4 h-4" /> 冷凍
            </button>
          </div>
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜尋名稱或條碼..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-14 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none"
              />
              <button
                onClick={() => handleStartScanner("search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-50 text-[#0058a3] rounded-lg flex items-center justify-center"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <select
                value={filterLocation}
                onChange={(e) => {
                  setFilterLocation(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-slate-600 outline-none"
              >
                <option value="all">全地點</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-slate-600 outline-none"
              >
                <option value="name_group">依名稱</option>
                <option value="expiry">依到期日</option>
                <option value="quantity">依數量</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                className="px-3 bg-white border-2 border-gray-200 rounded-xl text-gray-500 flex items-center justify-center"
              >
                <ArrowUpDown
                  className={`w-5 h-5 ${
                    sortOrder === "desc" ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {auth.role === "admin" && (
          <div className="flex justify-between items-center mb-4 bg-white p-2.5 rounded-xl border-2 border-gray-200 shadow-sm">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-600">
              <input
                type="checkbox"
                checked={
                  currentDisplayIds.length > 0 &&
                  selectedIds.size === currentDisplayIds.length
                }
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-[#0058a3] rounded"
              />
              全選本頁 (
              {selectedIds.size > 0
                ? `已選 ${selectedIds.size}`
                : `共 ${displayList.length} 組`}
              )
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-red-700 flex items-center gap-1"
              >
                <Trash className="w-4 h-4" /> 大量刪除
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400 font-bold">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#0058a3]" />{" "}
            載入中...
          </div>
        ) : paginatedList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 font-bold tracking-widest">
            目前條件下沒有商品唷！
          </div>
        ) : (
          <div className="space-y-5">
            {paginatedList.map((group) => (
              <div
                key={group.key}
                className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden relative"
              >
                <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="font-black text-slate-800 text-lg leading-tight flex items-center gap-2">
                      <Package className="w-5 h-5 text-gray-400" /> {group.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-black tracking-widest ${
                          group.category === "frozen"
                            ? "bg-[#0058a3]/10 text-[#0058a3]"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {group.category === "frozen" ? "冷凍" : "常溫"}
                      </span>
                      <div className="text-xs text-slate-500 font-mono">
                        <Barcode className="w-3.5 h-3.5 inline mr-1" />
                        {group.barcode}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 font-bold">
                      總數量
                    </span>
                    <div className="text-2xl font-black text-[#0058a3]">
                      {group.totalQuantity}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white space-y-3">
                  {group.batches.map((product) => {
                    const status = getExpiryStatus(
                      product.expiryDate,
                      product.reminderDays,
                      product.hasSecondReminder,
                      product.reminderDays2
                    );
                    const isFIFO = fifoIds.has(product.id);
                    const isActuallySoldOut =
                      product.isSoldOut || product.quantity <= 0;

                    return (
                      <div
                        key={product.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border-2 relative transition ${
                          isActuallySoldOut
                            ? "bg-gray-100 border-gray-300 opacity-70"
                            : isFIFO
                            ? "border-[#0058a3] bg-blue-50/30"
                            : status.border
                        }`}
                      >
                        {isFIFO && !isActuallySoldOut && (
                          <div className="absolute -top-3 -right-2 z-[10]">
                            <span className="bg-[#0058a3] text-[#FBD914] text-[10px] font-black px-2.5 py-1 rounded-full shadow-md animate-pulse border-2 border-white">
                              🏷️ 全店最先到期
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 flex-1 mb-3 sm:mb-0">
                          {auth.role === "admin" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(product.id)}
                              onChange={() => {
                                const next = new Set(selectedIds);
                                if (next.has(product.id))
                                  next.delete(product.id);
                                else next.add(product.id);
                                setSelectedIds(next);
                              }}
                              className="w-4 h-4 accent-[#0058a3] rounded"
                            />
                          )}
                          <div className="flex flex-col gap-1 w-full">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 flex-wrap">
                              <MapPin className="w-4 h-4 text-[#0058a3]" />{" "}
                              {product.location || "未指定"}{" "}
                              {(!product.locationUpdatedAt || (new Date() - new Date(product.locationUpdatedAt)) > 14 * 24 * 60 * 60 * 1000) && !isActuallySoldOut && (
                                <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-md font-bold">
                                  待確認
                                </span>
                              )}
                              <span className="text-gray-300 ml-1">|</span> 數量:{" "}
                              <span
                                className={
                                  isActuallySoldOut
                                    ? "text-red-500 font-black"
                                    : ""
                                }
                              >
                                {product.quantity}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 flex flex-wrap gap-2 items-center">
                              <span>進: {product.receiveDate}</span>
                              <span className="font-bold text-slate-700">
                                期: {product.expiryDate}
                              </span>
                              {!isActuallySoldOut && (
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {product.lastUpdatedBy ? `${product.lastUpdatedBy}異動` : "系統"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                          {!isActuallySoldOut && (
                            <div
                              className={`px-3 py-1.5 rounded-lg ${status.bg} ${status.color} font-black text-xs flex flex-col items-center justify-center min-w-[70px] shadow-sm`}
                            >
                              <span>{status.label}</span>
                              <span>
                                {status.status === "expired"
                                  ? `超${status.days}天`
                                  : `剩${status.days}天`}
                              </span>
                            </div>
                          )}
                          {isActuallySoldOut && (
                            <div className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-500 font-black text-xs flex items-center justify-center shadow-sm">
                              已售完
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            {!isActuallySoldOut && (
                              <>
                                <button
                                  onClick={() => handleQuantityMinus(product)}
                                  className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 justify-center"
                                >
                                  <Minus className="w-4 h-4" />
                                  <span className="text-xs font-bold">1</span>
                                </button>
                                <button
                                  onClick={() => handleMarkSoldOut(product)}
                                  className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center justify-center"
                                >
                                  賣完
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleEdit(product)}
                              className="p-2 text-[#0058a3] bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {auth.role === "admin" && (
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white border-2 border-gray-200 rounded-xl disabled:opacity-50 flex items-center justify-center"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="font-bold text-slate-600">
              第 {currentPage} 頁，共 {totalPages} 頁
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white border-2 border-gray-200 rounded-xl disabled:opacity-50 flex items-center justify-center"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </main>

      <footer className="w-full text-center py-6 text-slate-400 text-xs font-bold tracking-widest relative z-10 flex flex-col gap-1">
        <span>&copy; {new Date().getFullYear()} 向即期品說再見. All rights reserved.</span>
        <span className="text-[10px] text-slate-300">Designed by NHS Peter Chen (Yow-Tyng Chen)</span>
      </footer>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 border-t-8 border-[#0058a3] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black flex items-center gap-2 text-[#0058a3]">
                <Settings className="w-6 h-6" /> 店鋪管理設定
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 bg-gray-100 rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              <button
                onClick={handleBulkSyncToSheet}
                disabled={isSyncing}
                className="w-full py-2.5 bg-blue-50 text-[#0058a3] border border-blue-200 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isSyncing ? "覆蓋同步中..." : "將目前庫存覆蓋至試算表"}
              </button>
            </div>
            <h3 className="font-bold text-sm text-slate-700 mb-2 border-b pb-1">
              地點設定
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                value={newLocationInput}
                onChange={(e) => setNewLocationInput(e.target.value)}
                placeholder="輸入新地點名稱..."
                className="flex-1 px-3 py-2 border-2 rounded-xl text-sm font-bold outline-none"
              />
              <button
                onClick={() => {
                  if (
                    !newLocationInput.trim() ||
                    locations.includes(newLocationInput.trim())
                  )
                    return;
                  const updated = [...locations, newLocationInput.trim()];
                  setLocations(updated);
                  if (useLocalMode)
                    localStorage.setItem(
                      `expiry_manager_settings_${auth.store}`,
                      JSON.stringify({
                        locations: updated,
                        customPassword: storePasswords[auth.store],
                        staffPassword: staffPasswords[auth.store],
                      })
                    );
                  else
                    db.collection("stores")
                      .doc(auth.store)
                      .collection("settings")
                      .doc("config")
                      .set({ locations: updated }, { merge: true });
                  setNewLocationInput("");
                  showToast("新增成功");
                }}
                disabled={!newLocationInput.trim()}
                className="px-4 py-2 bg-[#0058a3] text-[#FBD914] font-bold rounded-xl flex items-center justify-center"
              >
                新增
              </button>
            </div>
            <div className="max-h-[20vh] overflow-y-auto space-y-2 mb-6">
              {locations.map((loc) => (
                <div
                  key={loc}
                  className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border"
                >
                  <span className="text-sm font-bold">{loc}</span>
                  <button
                    onClick={() =>
                      confirmAction(`刪除地點 ${loc}?`, () => {
                        const updated = locations.filter((l) => l !== loc);
                        setLocations(updated);
                        if (useLocalMode)
                          localStorage.setItem(
                            `expiry_manager_settings_${auth.store}`,
                            JSON.stringify({
                              locations: updated,
                              customPassword: storePasswords[auth.store],
                              staffPassword: staffPasswords[auth.store],
                            })
                          );
                        else
                          db.collection("stores")
                            .doc(auth.store)
                            .collection("settings")
                            .doc("config")
                            .set({ locations: updated }, { merge: true });
                      })
                    }
                    className="p-1.5 text-red-400 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <h3 className="font-bold text-sm text-slate-700 mb-2 border-b pb-1">
              安全設定
            </h3>
            {!isEditingPassword ? (
              <button
                onClick={() => setIsEditingPassword(true)}
                className="w-full py-2.5 border-2 rounded-xl text-slate-600 font-bold"
              >
                修改各級密碼
              </button>
            ) : (
              <div className="space-y-2 animate-in fade-in">
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="新管理員密碼..."
                  className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold outline-none"
                />
                <input
                  type="text"
                  value={newStaffPwdInput}
                  onChange={(e) => setNewStaffPwdInput(e.target.value)}
                  placeholder="新一般員工密碼..."
                  className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newAdmin =
                        newPasswordInput.trim() ||
                        storePasswords[auth.store] ||
                        "8888";
                      const newStaff =
                        newStaffPwdInput.trim() ||
                        staffPasswords[auth.store] ||
                        "1234";
                      if (db && !useLocalMode) {
                        db.collection("stores")
                          .doc(auth.store)
                          .collection("settings")
                          .doc("config")
                          .set(
                            {
                              customPassword: newAdmin,
                              staffPassword: newStaff,
                            },
                            { merge: true }
                          );
                      } else {
                        const localSettings = JSON.parse(
                          localStorage.getItem(
                            `expiry_manager_settings_${auth.store}`
                          )
                        ) || {
                          locations: ["倉庫A", "展示架", "冷藏室", "冷凍庫"],
                        };
                        localSettings.customPassword = newAdmin;
                        localSettings.staffPassword = newStaff;
                        localStorage.setItem(
                          `expiry_manager_settings_${auth.store}`,
                          JSON.stringify(localSettings)
                        );
                      }
                      setStorePasswords((prev) => ({
                        ...prev,
                        [auth.store]: newAdmin,
                      }));
                      setStaffPasswords((prev) => ({
                        ...prev,
                        [auth.store]: newStaff,
                      }));
                      setIsEditingPassword(false);
                      showToast("密碼已更新");
                    }}
                    className="flex-1 py-2 bg-orange-500 text-white font-bold rounded-xl text-sm flex items-center justify-center"
                  >
                    確認更新
                  </button>
                  <button
                    onClick={() => setIsEditingPassword(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-600 font-bold rounded-xl text-sm flex items-center justify-center"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isCalendarOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 bg-[#0058a3] text-white flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-[#FBD914]" /> 效期日曆
              </h2>
              <button
                onClick={() => setIsCalendarOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full flex items-center justify-center"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-4 px-2">
                <button
                  onClick={() =>
                    setCalendarDate(
                      new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() - 1,
                        1
                      )
                    )
                  }
                  className="p-2 bg-gray-100 rounded-full flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-black text-lg text-[#0058a3]">
                  {calendarDate.getFullYear()} 年 {calendarDate.getMonth() + 1}{" "}
                  月
                </h3>
                <button
                  onClick={() =>
                    setCalendarDate(
                      new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() + 1,
                        1
                      )
                    )
                  }
                  className="p-2 bg-gray-100 rounded-full flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-black text-gray-400">
                <div>日</div>
                <div>一</div>
                <div>二</div>
                <div>三</div>
                <div>四</div>
                <div>五</div>
                <div>六</div>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-6">
                {renderCalendar()}
              </div>
              {selectedCalendarDay && (
                <div className="border-t-2 border-dashed pt-4">
                  <h4 className="font-black text-slate-800 mb-3 flex items-center gap-2">
                    <span className="bg-[#FBD914] text-[#0058a3] px-2 py-1 rounded text-xs">
                      {selectedCalendarDay}
                    </span>{" "}
                    到期商品
                  </h4>
                  <div className="space-y-2">
                    {products.filter(
                      (p) =>
                        p.expiryDate === selectedCalendarDay &&
                        !p.isSoldOut &&
                        p.quantity > 0
                    ).length === 0 ? (
                      <p className="text-gray-400 text-sm font-bold text-center py-4 bg-gray-50 rounded-xl">
                        此日無商品到期
                      </p>
                    ) : (
                      products
                        .filter(
                          (p) =>
                            p.expiryDate === selectedCalendarDay &&
                            !p.isSoldOut &&
                            p.quantity > 0
                        )
                        .map((p) => (
                          <div
                            key={p.id}
                            className="bg-white p-3 rounded-xl flex justify-between items-center border-2 shadow-sm"
                          >
                            <span className="font-bold text-sm text-slate-700 truncate mr-2">
                              {p.name}
                            </span>
                            <span className="text-xs font-black px-2 py-1 bg-blue-50 text-[#0058a3] rounded">
                              數量: {p.quantity}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex flex-col items-center justify-start pt-[8vh] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-10 border border-gray-100">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="font-black text-[#0058a3] flex items-center gap-2 text-xl">
                <Package className="w-6 h-6 text-[#FBD914]" />{" "}
                {editingId ? "編輯商品" : "新增商品"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:bg-gray-200 rounded-full flex items-center justify-center"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-5 flex-1 custom-scrollbar">
              <form
                id="productForm"
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      商品條碼
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="barcode"
                        required
                        value={formData.barcode}
                        onChange={handleInputChange}
                        disabled={auth.role !== "admin" && editingId}
                        className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleStartScanner("form")}
                        disabled={auth.role !== "admin" && editingId}
                        className="px-3 py-2 bg-blue-50 text-[#0058a3] rounded-xl border border-blue-200 flex items-center justify-center"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      溫層選擇
                    </label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: "room_temp" })
                        }
                        className={`flex-1 py-1.5 text-xs font-black rounded-lg flex items-center justify-center ${
                          formData.category === "room_temp"
                            ? "bg-[#0058a3] text-white"
                            : "text-gray-500"
                        }`}
                      >
                        常溫
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: "frozen" })
                        }
                        className={`flex-1 py-1.5 text-xs font-black rounded-lg flex items-center justify-center ${
                          formData.category === "frozen"
                            ? "bg-[#0058a3] text-white"
                            : "text-gray-500"
                        }`}
                      >
                        冷凍
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      商品名稱
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={auth.role !== "admin" && editingId}
                      className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      存放地點
                    </label>
                    <select
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none"
                    >
                      <option value="">請選擇...</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      進貨日期
                    </label>
                    <input
                      type="date"
                      name="receiveDate"
                      required
                      value={formData.receiveDate}
                      onChange={handleInputChange}
                      disabled={auth.role !== "admin" && editingId}
                      className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      有效期限
                    </label>
                    <input
                      type="date"
                      name="expiryDate"
                      required
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      disabled={auth.role !== "admin" && editingId}
                      className="w-full px-3 py-2 border-2 border-[#0058a3] bg-[#0058a3]/5 rounded-xl text-sm font-black focus:border-[#0058a3] outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      數量
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      min="0"
                      required
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold bg-[#FBD914]/10 focus:border-[#0058a3] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      提醒(天)
                    </label>
                    <input
                      type="number"
                      name="reminderDays"
                      min="1"
                      required
                      value={formData.reminderDays}
                      onChange={handleInputChange}
                      disabled={auth.role !== "admin" && editingId}
                      className="w-full px-3 py-2 border-2 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none"
                    />
                  </div>
                  <div className="bg-gray-50 border-2 rounded-xl p-2 flex flex-col justify-center">
                    <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-700 mb-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        name="hasSecondReminder"
                        checked={formData.hasSecondReminder}
                        onChange={handleInputChange}
                        disabled={auth.role !== "admin" && editingId}
                        className="w-3 h-3 accent-[#0058a3]"
                      />{" "}
                      第二提醒
                    </label>
                    {formData.hasSecondReminder ? (
                      <input
                        type="number"
                        name="reminderDays2"
                        min="1"
                        required
                        value={formData.reminderDays2}
                        onChange={handleInputChange}
                        disabled={auth.role !== "admin" && editingId}
                        className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs font-bold outline-none"
                      />
                    ) : (
                      <div className="text-[10px] text-gray-400 font-bold text-center">
                        未啟用
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 bg-gray-50 flex gap-3 justify-end rounded-b-3xl border-t">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-3 text-slate-600 bg-white border-2 font-black rounded-xl text-sm flex items-center justify-center"
              >
                取消
              </button>
              <button
                type="submit"
                form="productForm"
                className="flex-1 px-6 py-3 bg-[#0058a3] text-[#FBD914] font-black rounded-xl shadow-md flex justify-center items-center gap-2"
              >
                <Save className="w-5 h-5" /> 儲存資料
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
