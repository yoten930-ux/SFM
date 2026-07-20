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
} from "lucide-react";

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load error for ${src}`));
    document.head.appendChild(script);
  });
};

const getTodayStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAWjwBTH3Wsv7ZSkR73W1o8hULF5uiWIws",
  authDomain: "ikea-36103.firebaseapp.com",
  projectId: "ikea-36103",
  storageBucket: "ikea-36103.firebasestorage.app",
  messagingSenderId: "174471808960",
  appId: "1:174471808960:web:27b2c4fff31422ce1bea25",
  measurementId: "G-LFL5ZDV54C",
};

// 分店資訊與專屬彩虹配色
const stores = ["內湖", "新莊", "新店", "小巨蛋", "青埔", "台中", "高雄"];
const STORE_COLORS = [
  "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100",
  "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
  "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
  "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100",
  "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100",
  "bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100",
  "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100",
];

export default function ExpiryManager() {
  const [db, setDb] = useState(null);
  const [useLocalMode, setUseLocalMode] = useState(true);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);

  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // 權限與分店登入
  const [auth, setAuth] = useState({ store: null, role: null, password: "" });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(true);
  const [storePasswords, setStorePasswords] = useState({}); // 各店自訂密碼

  // UI 與過濾狀態
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_group"); // 預設依名稱群組化
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // all, warning, expired
  const [filterLocation, setFilterLocation] = useState("all");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [newLocationInput, setNewLocationInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // 批量操作
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 預設 60 天提醒
  const defaultForm = {
    barcode: "",
    name: "",
    category: "room_temp",
    location: "",
    receiveDate: getTodayStr(),
    expiryDate: "",
    quantity: 1,
    reminderDays: 60,
    hasSecondReminder: false,
    reminderDays2: 14,
  };
  const [formData, setFormData] = useState(defaultForm);

  const [isImporting, setIsImporting] = useState(false);
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
    setLoading(false);
  };

  useEffect(() => {
    if (!librariesLoaded || !auth.store) return;
    setLoading(true);

    if (!firebaseConfig.apiKey) {
      loadLocalData(auth.store);
      return;
    }

    try {
      if (!window.firebase.apps.length)
        window.firebase.initializeApp(firebaseConfig);
      const firestoreDb = window.firebase.firestore();
      const firebaseAuth = window.firebase.auth();

      firebaseAuth.signInAnonymously().then(() => {
        setDb(firestoreDb);
        setUseLocalMode(false);

        // 讀取該分店商品
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

        // 讀取該分店獨立地點與密碼設定
        const unsubscribeSettings = firestoreDb
          .collection("stores")
          .doc(auth.store)
          .collection("settings")
          .doc("config")
          .onSnapshot((docSnap) => {
            if (docSnap.exists) {
              setLocations(
                docSnap.data().locations || [
                  "倉庫A",
                  "展示架",
                  "冷藏室",
                  "冷凍庫",
                ]
              );
              setStorePasswords((prev) => ({
                ...prev,
                [auth.store]: docSnap.data().customPassword,
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

  const showToast = (message, type = "info") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const confirmAction = (message, onConfirm) => {
    setConfirmDialog({ message, onConfirm });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const inputPwd = auth.password;
    const customAdminPwd = storePasswords[auth.store] || "8888";

    if (inputPwd === customAdminPwd) {
      setAuth((prev) => ({ ...prev, role: "admin" }));
      setIsLoginModalOpen(false);
      showToast(`登入成功：${auth.store} (管理者)`, "success");
    } else if (inputPwd === "1234") {
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

  useEffect(() => {
    if (formData.barcode && !editingId) {
      const localMatch = products.find((p) => p.barcode === formData.barcode);
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

  const handleStartScanner = (target) => {
    if (!window.Html5Qrcode)
      return showToast("掃描套件載入中，請稍後", "warning");
    setScannerTarget(target);
    setIsScannerOpen(true);

    setTimeout(() => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const boxSize = Math.min(window.innerWidth - 40, 300);
        html5QrCode
          .start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: boxSize, height: boxSize } },
            (decodedText) => {
              if (target === "form")
                setFormData((prev) => ({ ...prev, barcode: decodedText }));
              else if (target === "search") setSearchQuery(decodedText);
              handleStopScanner();
            },
            () => {}
          )
          .catch(() => {
            showToast("無法啟動相機，請確認瀏覽器相機權限", "error");
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

  const handleEdit = (product) => {
    setFormData(product);
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      name: formData.name.trim(),
      barcode: formData.barcode.trim(),
      quantity: Number(formData.quantity),
      reminderDays: Number(formData.reminderDays),
      reminderDays2: Number(formData.reminderDays2),
      updatedAt: new Date().toISOString(),
    };

    if (useLocalMode) {
      let updatedProducts = [...products];
      if (editingId) {
        updatedProducts = updatedProducts.map((p) =>
          p.id === editingId ? { ...dataToSave, id: editingId } : p
        );
      } else {
        const existingIdx = updatedProducts.findIndex(
          (p) =>
            p.barcode === dataToSave.barcode &&
            p.name === dataToSave.name &&
            p.expiryDate === dataToSave.expiryDate &&
            p.receiveDate === dataToSave.receiveDate &&
            p.location === dataToSave.location
        );
        if (existingIdx >= 0) {
          updatedProducts[existingIdx].quantity += dataToSave.quantity;
        } else {
          updatedProducts.push({ ...dataToSave, id: Date.now().toString() });
        }
      }
      setProducts(updatedProducts);
      localStorage.setItem(
        `expiry_products_${auth.store}`,
        JSON.stringify(updatedProducts)
      );
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
      } else {
        const existingIdx = products.findIndex(
          (p) =>
            p.barcode === dataToSave.barcode &&
            p.name === dataToSave.name &&
            p.expiryDate === dataToSave.expiryDate &&
            p.receiveDate === dataToSave.receiveDate &&
            p.location === dataToSave.location
        );
        if (existingIdx >= 0) {
          const existingItem = products[existingIdx];
          batch.update(
            db
              .collection("stores")
              .doc(auth.store)
              .collection("products")
              .doc(existingItem.id),
            { quantity: existingItem.quantity + dataToSave.quantity }
          );
        } else {
          batch.set(
            db
              .collection("stores")
              .doc(auth.store)
              .collection("products")
              .doc(),
            dataToSave
          );
        }
      }

      if (dataToSave.barcode) {
        const masterId = dataToSave.barcode.replace(/\//g, "_");
        batch.set(
          db.collection("master_products").doc(masterId),
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
    }
    showToast(editingId ? "修改成功" : "新增/整併成功", "success");
    closeModal();
  };

  const handleDelete = (id) => {
    if (auth.role !== "admin")
      return showToast("權限不足：僅管理者可刪除", "error");
    confirmAction("確定要刪除這筆庫存嗎？", async () => {
      if (useLocalMode) {
        const updatedProducts = products.filter((p) => p.id !== id);
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
      showToast("商品已刪除");
    });
  };

  const handleBulkDelete = () => {
    if (auth.role !== "admin")
      return showToast("權限不足：僅管理者可刪除", "error");
    if (selectedIds.size === 0) return;
    confirmAction(
      `確定要刪除選取的 ${selectedIds.size} 筆庫存嗎？`,
      async () => {
        if (useLocalMode) {
          const updatedProducts = products.filter(
            (p) => !selectedIds.has(p.id)
          );
          setProducts(updatedProducts);
          localStorage.setItem(
            `expiry_products_${auth.store}`,
            JSON.stringify(updatedProducts)
          );
        } else if (db) {
          const batch = db.batch();
          selectedIds.forEach((id) => {
            const ref = db
              .collection("stores")
              .doc(auth.store)
              .collection("products")
              .doc(id);
            batch.delete(ref);
          });
          await batch.commit();
        }
        setSelectedIds(new Set());
        showToast(`成功刪除 ${selectedIds.size} 筆商品`);
      }
    );
  };

  const toggleSelectAll = (currentDisplayIds) => {
    if (selectedIds.size === currentDisplayIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentDisplayIds));
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (auth.role !== "admin") return showToast("僅管理者可新增地點", "error");
    const newLoc = newLocationInput.trim();
    if (!newLoc || locations.includes(newLoc)) return;
    const updatedLocations = [...locations, newLoc];
    if (useLocalMode) {
      setLocations(updatedLocations);
      localStorage.setItem(
        `expiry_manager_settings_${auth.store}`,
        JSON.stringify({ locations: updatedLocations })
      );
    } else if (db) {
      await db
        .collection("stores")
        .doc(auth.store)
        .collection("settings")
        .doc("config")
        .set({ locations: updatedLocations }, { merge: true });
    }
    setNewLocationInput("");
    showToast("地點已新增");
  };

  const handleDeleteLocation = (locToDelete) => {
    if (auth.role !== "admin") return showToast("僅管理者可刪除地點", "error");
    confirmAction(`確定要刪除地點「${locToDelete}」嗎？`, async () => {
      const updatedLocations = locations.filter((l) => l !== locToDelete);
      if (useLocalMode) {
        setLocations(updatedLocations);
        localStorage.setItem(
          `expiry_manager_settings_${auth.store}`,
          JSON.stringify({ locations: updatedLocations })
        );
      } else if (db) {
        await db
          .collection("stores")
          .doc(auth.store)
          .collection("settings")
          .doc("config")
          .set({ locations: updatedLocations }, { merge: true });
      }
      showToast("地點已刪除");
    });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (auth.role !== "admin") return showToast("僅管理者可修改密碼", "error");
    const pwd = newPasswordInput.trim();
    if (pwd.length < 4) return showToast("密碼至少需4碼", "warning");

    if (db && !useLocalMode) {
      await db
        .collection("stores")
        .doc(auth.store)
        .collection("settings")
        .doc("config")
        .set({ customPassword: pwd }, { merge: true });
    }
    setStorePasswords((prev) => ({ ...prev, [auth.store]: pwd }));
    setNewPasswordInput("");
    setIsEditingPassword(false);
    showToast("管理員密碼已更新");
  };

  // 視覺化效期 4 色碼
  const getExpiryStatus = (expiryDate) => {
    const today = new Date(getTodayStr());
    const expDate = new Date(expiryDate);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: "expired",
        label: "已過期",
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        days: Math.abs(diffDays),
      };
    } else if (diffDays <= 30) {
      return {
        status: "danger",
        label: "高度警戒",
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        days: diffDays,
      };
    } else if (diffDays <= 60) {
      return {
        status: "warning",
        label: "中度警戒",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        days: diffDays,
      };
    } else {
      return {
        status: "safe",
        label: "安全無虞",
        color: "text-green-600",
        bg: "bg-green-50",
        border: "border-green-200",
        days: diffDays,
      };
    }
  };

  // 智慧 Excel 日期解析引擎
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
    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(
        2,
        "0"
      )}`;
    }
    const match8 = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match8) {
      return `${match8[1]}-${match8[2]}-${match8[3]}`;
    }
    return "";
  };

  const handleExcelImport = (e) => {
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
          showToast(`已從檔名帶入進貨日期：${defaultReceiveDate}`);
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
        for (const row of data) {
          const rawQuantity =
            row["數量(最小單位)"] ||
            row["數量"] ||
            row["庫存"] ||
            row["Qty"] ||
            1;
          const name = String(
            row["商品名稱"] ||
              row["品名"] ||
              row["名稱"] ||
              row["產品名稱"] ||
              "未命名"
          ).trim();

          let rawBarcode =
            row["貨號"] ||
            row["商品條碼"] ||
            row["條碼"] ||
            row["國際條碼"] ||
            row["Barcode"] ||
            row["Item Code"];
          const barcode = rawBarcode ? String(rawBarcode).trim() : name;

          let category = "room_temp";
          if (String(row["溫層"] || row["分類"] || "").includes("冷凍"))
            category = "frozen";

          const localMatch = products.find((p) => p.barcode === barcode);
          if (localMatch) category = localMatch.category;

          const expiryRaw =
            row["有效期限"] ||
            row["到期日"] ||
            row["到期日期"] ||
            row["效期"] ||
            row["Expiry"];

          const product = {
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
            expiryDate: formatExcelDate(expiryRaw),
            quantity: Number(rawQuantity),
            reminderDays: Number(
              row["提醒天數"] || (localMatch ? localMatch.reminderDays : 60)
            ),
            hasSecondReminder: localMatch
              ? localMatch.hasSecondReminder
              : false,
            reminderDays2: localMatch ? localMatch.reminderDays2 : 14,
            updatedAt: new Date().toISOString(),
          };

          if (product.name && product.expiryDate) newProducts.push(product);
        }

        let updatedProducts = [...products];
        const mergedExistingProducts = {};
        const finalNewProducts = [];

        newProducts.forEach((newProd) => {
          const existingIdx = updatedProducts.findIndex(
            (p) =>
              p.barcode === newProd.barcode &&
              p.name === newProd.name &&
              p.expiryDate === newProd.expiryDate &&
              p.receiveDate === newProd.receiveDate &&
              p.location === newProd.location
          );
          if (existingIdx >= 0) {
            updatedProducts[existingIdx].quantity += newProd.quantity;
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
          for (const prod of finalNewProducts) {
            batch.set(
              db
                .collection("stores")
                .doc(auth.store)
                .collection("products")
                .doc(prod.id),
              prod
            );
          }
          for (const id in mergedExistingProducts) {
            batch.update(
              db
                .collection("stores")
                .doc(auth.store)
                .collection("products")
                .doc(id),
              {
                quantity: mergedExistingProducts[id].quantity,
              }
            );
          }
          await batch.commit();
        }
        showToast(`成功處理並匯入 ${newProducts.length} 筆資料`, "success");
      } catch (error) {
        showToast("匯入失敗，請確認格式", "error");
      } finally {
        setIsImporting(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelExport = () => {
    if (!window.XLSX) return showToast("Excel 套件載入中", "warning");
    if (auth.role !== "admin") return showToast("僅管理者可匯出資料", "error");
    if (products.length === 0)
      return showToast("目前沒有資料可以匯出", "warning");

    const exportData = products.map((p) => ({
      貨號: p.barcode,
      商品名稱: p.name,
      溫層: p.category === "frozen" ? "冷凍" : "常溫",
      存放地點: p.location || "",
      "數量(最小單位)": p.quantity,
      進貨日期: p.receiveDate,
      有效期限: p.expiryDate,
      提醒天數: p.reminderDays,
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "庫存報表");

    const filename = `${auth.store}_庫存報表_${getTodayStr()}.xlsx`;
    window.XLSX.writeFile(wb, filename);
    showToast("匯出成功", "success");
  };

  let filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    if (!matchSearch) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterLocation !== "all" && p.location !== filterLocation) return false;
    if (filterStatus !== "all") {
      const st = getExpiryStatus(p.expiryDate);
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

  let displayList = [];
  if (sortBy === "name_group") {
    const groups = {};
    filteredProducts.forEach((p) => {
      const key = `${String(p.barcode).trim()}_${String(p.name).trim()}`;
      if (!groups[key])
        groups[key] = {
          key,
          name: p.name,
          barcode: p.barcode,
          category: p.category,
          totalQuantity: 0,
          batches: [],
        };
      groups[key].totalQuantity += p.quantity;
      groups[key].batches.push(p);
    });

    Object.values(groups).forEach((g) => {
      g.batches.sort((a, b) => {
        const expDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
        return expDiff !== 0
          ? expDiff
          : new Date(a.receiveDate) - new Date(b.receiveDate);
      });
      displayList.push(g);
    });
    displayList.sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));
  } else {
    displayList = [...filteredProducts];
    displayList.sort((a, b) => {
      let result = 0;
      if (sortBy === "expiry")
        result = new Date(a.expiryDate) - new Date(b.expiryDate);
      else if (sortBy === "quantity") result = a.quantity - b.quantity;
      return sortOrder === "asc" ? result : -result;
    });
  }

  const totalPages = Math.ceil(displayList.length / itemsPerPage);
  const paginatedList = displayList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 先進先出 (FIFO) 智慧標籤邏輯：優先比效期，效期相同比進貨日
  const fifoIds = new Set();
  const barcodeToEarliest = {};

  products.forEach((p) => {
    const diff = Math.ceil(
      (new Date(p.expiryDate) - new Date(getTodayStr())) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0) {
      // 包含當天到期的也能被標記為FIFO
      const currentEarliest = barcodeToEarliest[p.barcode];

      if (!currentEarliest) {
        barcodeToEarliest[p.barcode] = {
          id: p.id,
          expiryDate: p.expiryDate,
          receiveDate: p.receiveDate,
        };
      } else {
        const pExp = new Date(p.expiryDate).getTime();
        const currExp = new Date(currentEarliest.expiryDate).getTime();

        if (pExp < currExp) {
          // 1. 效期更早，絕對優先使用
          barcodeToEarliest[p.barcode] = {
            id: p.id,
            expiryDate: p.expiryDate,
            receiveDate: p.receiveDate,
          };
        } else if (pExp === currExp) {
          // 2. 若效期完全相同，則比較進貨日 (越早進貨越先用)
          const pRec = new Date(p.receiveDate).getTime();
          const currRec = new Date(currentEarliest.receiveDate).getTime();
          if (pRec < currRec) {
            barcodeToEarliest[p.barcode] = {
              id: p.id,
              expiryDate: p.expiryDate,
              receiveDate: p.receiveDate,
            };
          }
        }
      }
    }
  });
  Object.values(barcodeToEarliest).forEach((item) => fifoIds.add(item.id));

  const currentDisplayIds =
    sortBy === "name_group"
      ? paginatedList.flatMap((g) => g.batches.map((b) => b.id))
      : paginatedList.map((p) => p.id);

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
      const dayProducts = products.filter((p) => p.expiryDate === dateStr);
      const isSelected = selectedCalendarDay === dateStr;

      let dotColor = "bg-[#0058a3]";
      if (
        dayProducts.some(
          (p) =>
            getExpiryStatus(p.expiryDate).status === "danger" ||
            getExpiryStatus(p.expiryDate).status === "expired"
        )
      ) {
        dotColor = "bg-red-500";
      }

      days.push(
        <button
          key={d}
          onClick={() => setSelectedCalendarDay(dateStr)}
          className={`p-2 border rounded-xl flex flex-col items-center justify-start h-14 relative transition 
            ${
              isSelected
                ? "ring-2 ring-[#0058a3] bg-blue-50"
                : "bg-white hover:bg-gray-50 border-gray-200"
            }
            ${
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
      <div className="min-h-screen bg-[#0058a3] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border-b-8 border-[#FBD914]">
          <div className="p-8 text-center bg-white">
            <div className="mx-auto w-24 h-24 mb-4 relative">
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full drop-shadow-lg"
              >
                <path
                  d="M50 15 L85 30 L85 70 L50 85 L15 70 L15 30 Z"
                  fill="#FBD914"
                  stroke="#0058a3"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <path
                  d="M50 15 L50 50 L85 30"
                  stroke="#0058a3"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 30 L50 50 L50 85"
                  stroke="#0058a3"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="35" cy="55" r="4" fill="#0058a3" />
                <circle cx="65" cy="55" r="4" fill="#0058a3" />
                <path
                  d="M42 65 Q50 72 58 65"
                  stroke="#0058a3"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-[#0058a3] tracking-wider mb-2">
              向即期品說再見
            </h1>

            {!auth.store ? (
              <>
                <p className="text-sm text-gray-500 font-medium mb-6">
                  請點擊選擇您的門市
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {stores.map((store, index) => (
                    <button
                      key={store}
                      onClick={() => setAuth((prev) => ({ ...prev, store }))}
                      className={`p-3 border-2 rounded-2xl font-bold text-lg transition-transform active:scale-95 ${
                        STORE_COLORS[index % STORE_COLORS.length]
                      }`}
                    >
                      {store}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() =>
                      setAuth({ store: null, role: null, password: "" })
                    }
                    className="text-gray-400 hover:text-[#0058a3] transition flex items-center gap-1 text-sm font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" /> 更換分店
                  </button>
                  <span className="font-black text-[#0058a3] bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                    {auth.store}店
                  </span>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <input
                    type="password"
                    placeholder="請輸入密碼..."
                    required
                    value={auth.password}
                    onChange={(e) =>
                      setAuth((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl font-bold text-center tracking-widest outline-none focus:border-[#0058a3] text-lg bg-gray-50 focus:bg-white transition"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full py-4 bg-[#0058a3] text-[#FBD914] font-black rounded-xl text-lg hover:bg-[#004a89] transition shadow-md border-b-4 border-[#003b6d] active:border-b-0 active:translate-y-1"
                  >
                    登 入 系 統
                  </button>
                </form>
              </div>
            )}
          </div>
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
                className="flex-1 py-2.5 rounded-xl border border-gray-300 font-bold text-slate-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0058a3] text-white font-bold shadow-md"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center">
          <div className="absolute top-6 right-6 z-10">
            <button
              onClick={handleStopScanner}
              className="bg-white/20 p-3 rounded-full text-white backdrop-blur-md hover:bg-white/30"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
          <div
            id="reader"
            className="w-full max-w-sm aspect-square bg-gray-900 overflow-hidden shadow-2xl rounded-2xl border-4 border-[#FBD914]"
          ></div>
          <p className="text-white mt-8 font-bold tracking-widest animate-pulse flex items-center gap-2 bg-black/50 px-6 py-2 rounded-full">
            <Camera className="w-5 h-5" /> 請將條碼置於正方形框內
          </p>
        </div>
      )}

      <header className="bg-[#0058a3] shadow-md sticky top-0 z-30 border-b-[6px] border-[#FBD914] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="w-10 h-10">
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full drop-shadow-md"
              >
                <path
                  d="M50 15 L85 30 L85 70 L50 85 L15 70 L15 30 Z"
                  fill="#FBD914"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
                <path
                  d="M50 15 L50 50 L85 30"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 30 L50 50 L50 85"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-xl text-white tracking-wider">
                向即期品說再見
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm font-bold tracking-wide">
                  {auth.store}店 ({auth.role === "admin" ? "管理" : "一般"})
                </span>
                <button
                  onClick={handleLogout}
                  className="text-white/70 hover:text-white transition"
                  title="登出"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => setIsCalendarOpen(true)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition border border-white/20"
              title="月曆"
            >
              <CalendarDays className="w-5 h-5" />
            </button>
            {auth.role === "admin" && (
              <>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition border border-white/20"
                  title="設定"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={handleExcelExport}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition border border-white/20"
                  title="匯出報表"
                >
                  <FileDown className="w-5 h-5" />
                </button>
                <label
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer transition border border-white/20 flex items-center justify-center"
                  title="匯入"
                >
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
              className="px-4 py-2.5 bg-[#FBD914] text-[#0058a3] hover:bg-[#f0cf13] rounded-xl font-black transition flex items-center gap-1 shadow-lg border-b-4 border-[#d4b50d] active:border-b-0 active:translate-y-1"
            >
              <Plus className="w-5 h-5" /> 新增商品
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div
            onClick={() => {
              setFilterStatus("all");
              setCurrentPage(1);
            }}
            className={`cursor-pointer transition p-3 rounded-2xl border-2 flex flex-col items-center justify-center shadow-sm ${
              filterStatus === "all"
                ? "bg-[#0058a3] border-[#0058a3] text-white"
                : "bg-white border-gray-200 text-slate-700"
            }`}
          >
            <span className="text-2xl font-black">{products.length}</span>
            <span className="text-[10px] font-bold tracking-widest mt-1 opacity-80">
              全部商品
            </span>
          </div>
          <div
            onClick={() => {
              setFilterStatus("warning");
              setCurrentPage(1);
            }}
            className={`cursor-pointer transition p-3 rounded-2xl border-2 flex flex-col items-center justify-center shadow-sm ${
              filterStatus === "warning"
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-orange-50 border-orange-200 text-orange-700"
            }`}
          >
            <span className="text-2xl font-black">
              {
                products.filter(
                  (p) =>
                    getExpiryStatus(p.expiryDate).status === "danger" ||
                    getExpiryStatus(p.expiryDate).status === "warning"
                ).length
              }
            </span>
            <span className="text-[10px] font-bold tracking-widest mt-1 opacity-80">
              近期警戒
            </span>
          </div>
          <div
            onClick={() => {
              setFilterStatus("expired");
              setCurrentPage(1);
            }}
            className={`cursor-pointer transition p-3 rounded-2xl border-2 flex flex-col items-center justify-center shadow-sm ${
              filterStatus === "expired"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-red-50 border-red-200 text-red-600"
            }`}
          >
            <span className="text-2xl font-black">
              {
                products.filter(
                  (p) => getExpiryStatus(p.expiryDate).status === "expired"
                ).length
              }
            </span>
            <span className="text-[10px] font-bold tracking-widest mt-1 opacity-80">
              已過期
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-2 bg-gray-200 p-1.5 rounded-xl w-full overflow-x-auto custom-scrollbar">
            <button
              onClick={() => {
                setFilterCategory("all");
                setCurrentPage(1);
              }}
              className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg transition ${
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
              className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1 ${
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
              className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1 ${
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
                className="w-full pl-12 pr-14 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition"
              />
              <button
                onClick={() => handleStartScanner("search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-50 text-[#0058a3] rounded-lg hover:bg-blue-100 transition"
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
                <option value="name_group">依名稱分組</option>
                <option value="expiry">依到期日</option>
                <option value="quantity">依數量</option>
              </select>
              {sortBy !== "name_group" && (
                <button
                  onClick={() =>
                    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                  className="px-3 bg-white border-2 border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition flex items-center justify-center"
                >
                  <ArrowUpDown
                    className={`w-5 h-5 transition-transform ${
                      sortOrder === "desc" ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
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
                onChange={() => toggleSelectAll(currentDisplayIds)}
                className="w-4 h-4 accent-[#0058a3] rounded"
              />
              全選本頁 (
              {selectedIds.size > 0
                ? `已選 ${selectedIds.size}`
                : `共 ${displayList.length} 筆`}
              )
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-red-700 animate-in fade-in flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> 大量刪除
              </button>
            )}
          </div>
        )}

        {loading || !auth.store ? (
          <div className="text-center py-20 text-gray-400 font-bold flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#0058a3]" />{" "}
            正在為您準備架上資料...
          </div>
        ) : paginatedList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center">
            <div className="w-20 h-20 mb-4 opacity-30 grayscale">
              <svg viewBox="0 0 100 100" fill="none">
                <path
                  d="M50 15 L85 30 L85 70 L50 85 L15 70 L15 30 Z"
                  fill="#FBD914"
                  stroke="#0058a3"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <path
                  d="M50 15 L50 50 L85 30"
                  stroke="#0058a3"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 30 L50 50 L50 85"
                  stroke="#0058a3"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-base text-gray-400 font-bold tracking-widest">
              目前條件下沒有商品唷！
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {paginatedList.map((item, index) => {
              if (sortBy === "name_group") {
                const group = item;
                return (
                  <div
                    key={group.key}
                    className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden relative"
                  >
                    <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                      <div className="flex-1">
                        <h3 className="font-black text-slate-800 text-lg leading-tight flex items-center gap-2">
                          <Package className="w-5 h-5 text-gray-400" />{" "}
                          {group.name}
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
                        const status = getExpiryStatus(product.expiryDate);
                        const isFIFO = fifoIds.has(product.id);
                        return (
                          <div
                            key={product.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border-2 relative transition ${
                              isFIFO
                                ? "border-[#0058a3] bg-blue-50/30"
                                : status.border
                            }`}
                          >
                            {isFIFO && (
                              <div className="absolute -top-3 -right-2 z-[10]">
                                <span className="bg-[#0058a3] text-[#FBD914] text-[10px] font-black px-2.5 py-1 rounded-full shadow-md animate-pulse border-2 border-white flex items-center gap-1 tracking-widest">
                                  🏷️ 請先使用此批
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
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                  <MapPin className="w-4 h-4 text-[#0058a3]" />{" "}
                                  {product.location || "未指定"}{" "}
                                  <span className="text-gray-300">|</span> 數量:{" "}
                                  {product.quantity}
                                </div>
                                <div className="text-xs text-gray-500 flex gap-2">
                                  <span>進: {product.receiveDate}</span>{" "}
                                  <span className="font-bold text-slate-700">
                                    期: {product.expiryDate}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
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
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleEdit(product)}
                                  className="p-2 text-[#0058a3] bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {auth.role === "admin" && (
                                  <button
                                    onClick={() => handleDelete(product.id)}
                                    className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
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
                );
              } else {
                const product = item;
                const status = getExpiryStatus(product.expiryDate);
                const isFIFO = fifoIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
                      isFIFO ? "border-[#0058a3]" : status.border
                    } relative flex flex-col sm:flex-row gap-4 transition hover:shadow-md`}
                  >
                    {isFIFO && (
                      <div className="absolute -top-3 -right-2 z-[10]">
                        <span className="bg-[#0058a3] text-[#FBD914] text-xs font-black px-3 py-1.5 rounded-full shadow-lg animate-pulse border-2 border-white flex items-center gap-1 tracking-widest">
                          🏷️ 請先使用此批
                        </span>
                      </div>
                    )}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-2.5 rounded-l-2xl ${status.bgBar}`}
                    />
                    <div className="flex-1 pl-3">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2">
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
                          <h3
                            className={`font-black leading-tight ${
                              isFIFO
                                ? "text-[#0058a3] text-xl"
                                : "text-slate-800 text-lg"
                            }`}
                          >
                            {product.name}
                          </h3>
                        </div>
                        <span
                          className={`text-[11px] px-2.5 py-1 rounded-md font-black tracking-widest flex-shrink-0 ${
                            product.category === "frozen"
                              ? "bg-[#0058a3]/10 text-[#0058a3]"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {product.category === "frozen" ? "冷凍" : "常溫"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-mono bg-slate-100 inline-flex px-2.5 py-1 rounded-md border border-slate-200">
                        <Barcode className="w-4 h-4" /> {product.barcode}
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 text-sm text-slate-600 font-bold">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#0058a3]" />{" "}
                          {product.location || "未指定"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-[#0058a3]" /> 數量:{" "}
                          <span className="text-lg text-slate-800">
                            {product.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2 text-xs bg-gray-50 p-2 rounded-lg border">
                          <CalendarDays className="w-4 h-4 text-gray-400" />
                          <span>進貨: {product.receiveDate}</span>
                          <span className="text-gray-300 mx-1">|</span>
                          <span>
                            到期:{" "}
                            <strong className="text-slate-800 text-sm">
                              {product.expiryDate}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 sm:pl-4 sm:border-l border-gray-100">
                      <div className="flex gap-2 sm:mb-4">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2.5 text-[#0058a3] bg-blue-50 hover:bg-blue-100 rounded-xl transition"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        {auth.role === "admin" && (
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <div
                        className={`px-4 py-2 rounded-xl ${status.bg} ${status.color} font-black text-sm flex flex-col items-center gap-0.5 shadow-sm`}
                      >
                        <span className="flex items-center gap-1">
                          {status.status === "expired" ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}{" "}
                          {status.label}
                        </span>
                        <span className="text-xs opacity-90">
                          {status.status === "expired"
                            ? `超過 ${status.days} 天`
                            : `剩 ${status.days} 天`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white border-2 border-gray-200 rounded-xl disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronLeft className="w-6 h-6 text-slate-700" />
            </button>
            <span className="font-bold text-slate-600">
              第 {currentPage} 頁，共 {totalPages} 頁
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white border-2 border-gray-200 rounded-xl disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronRight className="w-6 h-6 text-slate-700" />
            </button>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 border-t-8 border-[#0058a3] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black flex items-center gap-2 text-[#0058a3]">
                <Settings className="w-6 h-6" /> 店鋪管理設定
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-bold text-sm text-slate-700 mb-2 border-b pb-1">
              地點設定
            </h3>
            <form onSubmit={handleAddLocation} className="flex gap-2 mb-4">
              <input
                value={newLocationInput}
                onChange={(e) => setNewLocationInput(e.target.value)}
                placeholder="輸入新地點名稱..."
                className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition"
              />
              <button
                type="submit"
                disabled={!newLocationInput.trim()}
                className="px-4 py-2 bg-[#0058a3] text-[#FBD914] font-bold rounded-xl disabled:opacity-50 hover:bg-[#004a89] transition"
              >
                新增
              </button>
            </form>
            <div className="max-h-[20vh] overflow-y-auto space-y-2 mb-6 custom-scrollbar pr-2">
              {locations.length === 0 ? (
                <p className="text-center text-gray-400 py-4 font-medium text-sm">
                  尚無地點，請新增
                </p>
              ) : (
                locations.map((loc) => (
                  <div
                    key={loc}
                    className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                  >
                    <span className="text-sm font-bold text-slate-700">
                      {loc}
                    </span>
                    <button
                      onClick={() => handleDeleteLocation(loc)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <h3 className="font-bold text-sm text-slate-700 mb-2 border-b pb-1">
              安全設定
            </h3>
            {!isEditingPassword ? (
              <button
                onClick={() => setIsEditingPassword(true)}
                className="w-full py-2.5 border-2 border-gray-200 rounded-xl text-slate-600 font-bold hover:bg-gray-50 transition text-sm"
              >
                修改管理員密碼
              </button>
            ) : (
              <form
                onSubmit={handleChangePassword}
                className="animate-in fade-in slide-in-from-top-2"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="設定新管理密碼..."
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-orange-500 outline-none transition min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={!newPasswordInput.trim()}
                    className="px-3 py-2 bg-orange-500 text-white font-bold rounded-xl disabled:opacity-50 hover:bg-orange-600 transition text-sm whitespace-nowrap"
                  >
                    確認
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPassword(false);
                      setNewPasswordInput("");
                    }}
                    className="px-3 py-2 bg-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-300 transition text-sm whitespace-nowrap"
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
            <p className="text-[10px] text-gray-400 mt-2">
              ＊此密碼僅套用於 {auth.store} 店的管理者登入
            </p>
          </div>
        </div>
      )}

      {isCalendarOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 bg-[#0058a3] text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
              <h2 className="text-xl font-black flex items-center gap-2 relative z-10">
                <CalendarDays className="w-6 h-6 text-[#FBD914]" /> 效期日曆
              </h2>
              <button
                onClick={() => setIsCalendarOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full relative z-10"
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
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
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
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
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
                      (p) => p.expiryDate === selectedCalendarDay
                    ).length === 0 ? (
                      <p className="text-gray-400 text-sm font-bold text-center py-4 bg-gray-50 rounded-xl">
                        此日無商品到期
                      </p>
                    ) : (
                      products
                        .filter((p) => p.expiryDate === selectedCalendarDay)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="bg-white p-3 rounded-xl flex justify-between items-center border-2 shadow-sm"
                          >
                            <span className="font-bold text-sm text-slate-700 truncate mr-2">
                              {p.name}
                            </span>
                            <span className="text-xs font-black px-2 py-1 bg-blue-50 text-[#0058a3] border border-blue-100 rounded">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-start pt-[8vh] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-10 shrink-0 border border-gray-100">
            <div className="w-full h-1.5 flex">
              <div className="bg-[#0058a3] flex-1"></div>
              <div className="bg-[#FBD914] w-1/4"></div>
              <div className="bg-[#0058a3] flex-1"></div>
            </div>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="font-black text-[#0058a3] flex items-center gap-2 text-xl tracking-wide">
                <Package className="w-6 h-6 text-[#FBD914]" />
                {editingId ? "編輯商品" : "新增商品"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:bg-gray-200 rounded-full"
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
                  <div className="min-w-0 box-border">
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
                        placeholder="輸入或掃描"
                        className="w-full min-w-0 px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#0058a3] outline-none transition box-border disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleStartScanner("form")}
                        disabled={auth.role !== "admin" && editingId}
                        className="px-3 py-2.5 bg-blue-50 text-[#0058a3] rounded-xl border border-blue-200 hover:bg-blue-100 transition shrink-0 disabled:opacity-50"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 box-border">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      溫層選擇
                    </label>
                    <div className="flex bg-gray-100 p-1.5 rounded-xl">
                      <button
                        type="button"
                        disabled={auth.role !== "admin" && editingId}
                        onClick={() =>
                          setFormData({ ...formData, category: "room_temp" })
                        }
                        className={`flex-1 py-1.5 text-xs font-black rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50 ${
                          formData.category === "room_temp"
                            ? "bg-[#0058a3] text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" /> 常溫
                      </button>
                      <button
                        type="button"
                        disabled={auth.role !== "admin" && editingId}
                        onClick={() =>
                          setFormData({ ...formData, category: "frozen" })
                        }
                        className={`flex-1 py-1.5 text-xs font-black rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-50 ${
                          formData.category === "frozen"
                            ? "bg-[#0058a3] text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        <Snowflake className="w-3.5 h-3.5" /> 冷凍
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0 box-border">
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
                      placeholder="請輸入名稱..."
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition box-border disabled:opacity-50 disabled:bg-gray-100"
                    />
                  </div>
                  <div className="min-w-0 box-border">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      存放地點
                    </label>
                    <select
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#0058a3] outline-none transition box-border"
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
                  <div className="min-w-0 box-border">
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#0058a3] outline-none transition box-border disabled:opacity-50"
                    />
                  </div>
                  <div className="min-w-0 box-border">
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
                      className="w-full px-3 py-2.5 border-2 border-[#0058a3] rounded-xl text-sm font-black bg-[#0058a3]/5 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition box-border disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="min-w-0 box-border">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      數量
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      required
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition box-border bg-[#FBD914]/10"
                    />
                  </div>
                  <div className="min-w-0 box-border">
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition box-border disabled:opacity-50"
                    />
                  </div>
                  <div className="min-w-0 box-border bg-gray-50 border-2 border-gray-200 rounded-xl p-2 flex flex-col justify-center">
                    <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-700 cursor-pointer mb-1.5">
                      <input
                        type="checkbox"
                        name="hasSecondReminder"
                        checked={formData.hasSecondReminder}
                        onChange={handleInputChange}
                        disabled={auth.role !== "admin" && editingId}
                        className="w-3.5 h-3.5 accent-[#0058a3] rounded disabled:opacity-50"
                      />
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
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-bold outline-none bg-white box-border focus:border-[#0058a3] disabled:opacity-50"
                      />
                    ) : (
                      <div className="text-[10px] text-gray-400 font-bold text-center mt-1">
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
                className="px-6 py-3 text-slate-600 bg-white border-2 border-gray-200 font-black rounded-xl text-sm hover:bg-gray-100 transition"
              >
                取消
              </button>
              <button
                type="submit"
                form="productForm"
                className="flex-1 px-6 py-3 bg-[#0058a3] hover:bg-[#004a89] text-[#FBD914] font-black rounded-xl shadow-md flex justify-center items-center gap-2 text-base transition border-b-4 border-[#003b6d] active:border-b-0 active:translate-y-1"
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
