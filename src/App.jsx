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

// 分店專屬配色
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

  // 客製化提示框 (取代 alert/confirm)
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // UI 控制狀態
  const [currentStore, setCurrentStore] = useState(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(true);
  const stores = ["內湖", "新莊", "新店", "小巨蛋", "青埔", "台中", "高雄"];

  // 搜尋與篩選控制
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // 新增：效期狀態篩選

  // 分頁控制
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // 設定與其他視窗
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [newLocationInput, setNewLocationInput] = useState("");

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const defaultForm = {
    barcode: "",
    name: "",
    category: "room_temp",
    location: "",
    receiveDate: getTodayStr(),
    expiryDate: "",
    quantity: 1,
    reminderDays: 7,
    hasSecondReminder: false,
    reminderDays2: 3,
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

  const loadLocalData = () => {
    setUseLocalMode(true);
    const localProducts =
      JSON.parse(localStorage.getItem(`expiry_products_${currentStore}`)) || [];
    const localSettings = JSON.parse(
      localStorage.getItem("expiry_manager_settings")
    ) || { locations: ["倉庫A", "展示架", "冷藏室", "冷凍庫"] };
    setProducts(localProducts);
    setLocations(localSettings.locations);
    setLoading(false);
  };

  useEffect(() => {
    if (!librariesLoaded || !currentStore) return;

    const initFirebase = async () => {
      if (!firebaseConfig.apiKey) {
        loadLocalData();
        return;
      }
      try {
        if (!window.firebase.apps.length)
          window.firebase.initializeApp(firebaseConfig);
        const firestoreDb = window.firebase.firestore();
        const auth = window.firebase.auth();

        await auth.signInAnonymously();
        setDb(firestoreDb);
        setUseLocalMode(false);

        firestoreDb
          .collection("stores")
          .doc(currentStore)
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
            (error) => {
              showToast("雲端資料讀取錯誤，切換為單機模式", "error");
              loadLocalData();
            }
          );

        firestoreDb
          .collection("settings")
          .doc("global")
          .onSnapshot((docSnap) => {
            if (docSnap.exists && docSnap.data().locations)
              setLocations(docSnap.data().locations);
            else setLocations(["倉庫A", "展示架", "冷藏室", "冷凍庫"]);
          });
      } catch (error) {
        loadLocalData();
      }
    };
    initFirebase();
  }, [librariesLoaded, currentStore]);

  const showToast = (message, type = "info") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const confirmAction = (message, onConfirm) => {
    setConfirmDialog({ message, onConfirm });
  };

  // 當任何篩選、搜尋、排序條件改變時，強制回到第一頁
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    filterCategory,
    filterLocation,
    filterStatus,
    sortBy,
    sortOrder,
  ]);

  // 智慧帶入：包含名稱、溫層、地點及所有提醒設定
  useEffect(() => {
    if (formData.barcode && !editingId) {
      const localMatch = products.find((p) => p.barcode === formData.barcode);
      if (localMatch) {
        setFormData((prev) => ({
          ...prev,
          name: prev.name || localMatch.name,
          category: localMatch.category,
          location: prev.location || localMatch.location,
          reminderDays: localMatch.reminderDays,
          hasSecondReminder: localMatch.hasSecondReminder || false,
          reminderDays2: localMatch.reminderDays2 || 3,
        }));
        return;
      }
      if (!useLocalMode && db) {
        db.collection("master_products")
          .doc(formData.barcode)
          .get()
          .then((docSnap) => {
            if (docSnap.exists) {
              const masterData = docSnap.data();
              setFormData((prev) => ({
                ...prev,
                name: prev.name || masterData.name,
                category: masterData.category || prev.category,
                reminderDays: masterData.reminderDays || prev.reminderDays,
                hasSecondReminder:
                  masterData.hasSecondReminder !== undefined
                    ? masterData.hasSecondReminder
                    : prev.hasSecondReminder,
                reminderDays2: masterData.reminderDays2 || prev.reminderDays2,
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, [formData.barcode, db, useLocalMode, editingId, products]);

  const handleStartScanner = (target) => {
    if (!window.Html5Qrcode) {
      showToast("掃描套件載入中，請稍後", "warning");
      return;
    }
    setScannerTarget(target);
    setIsScannerOpen(true);

    setTimeout(() => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        // 加大判定範圍：300x300 正方形
        const boxSize = Math.min(window.innerWidth - 60, 300);

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
            (errorMessage) => {
              /* 背景掃描錯誤略過 */
            }
          )
          .catch((err) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      quantity: Number(formData.quantity),
      reminderDays: Number(formData.reminderDays),
      reminderDays2: Number(formData.reminderDays2),
      updatedAt: new Date().toISOString(),
    };

    if (useLocalMode) {
      let updatedProducts = editingId
        ? products.map((p) =>
            p.id === editingId ? { ...dataToSave, id: editingId } : p
          )
        : [...products, { ...dataToSave, id: Date.now().toString() }];
      setProducts(updatedProducts);
      localStorage.setItem(
        `expiry_products_${currentStore}`,
        JSON.stringify(updatedProducts)
      );
    } else if (db && currentStore) {
      const batch = db.batch();
      if (editingId)
        batch.update(
          db
            .collection("stores")
            .doc(currentStore)
            .collection("products")
            .doc(editingId),
          dataToSave
        );
      else
        batch.set(
          db
            .collection("stores")
            .doc(currentStore)
            .collection("products")
            .doc(),
          dataToSave
        );

      if (formData.barcode) {
        batch.set(
          db.collection("master_products").doc(formData.barcode),
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
    showToast(editingId ? "修改成功" : "新增成功", "success");
    closeModal();
  };

  const handleDelete = (id) => {
    confirmAction("確定要刪除這筆庫存嗎？", async () => {
      if (useLocalMode) {
        const updatedProducts = products.filter((p) => p.id !== id);
        setProducts(updatedProducts);
        localStorage.setItem(
          `expiry_products_${currentStore}`,
          JSON.stringify(updatedProducts)
        );
      } else if (db) {
        await db
          .collection("stores")
          .doc(currentStore)
          .collection("products")
          .doc(id)
          .delete();
      }
      showToast("商品已刪除");
    });
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    const newLoc = newLocationInput.trim();
    if (!newLoc || locations.includes(newLoc)) return;
    const updatedLocations = [...locations, newLoc];
    if (useLocalMode) {
      setLocations(updatedLocations);
      localStorage.setItem(
        "expiry_manager_settings",
        JSON.stringify({ locations: updatedLocations })
      );
    } else if (db) {
      await db
        .collection("settings")
        .doc("global")
        .set({ locations: updatedLocations }, { merge: true });
    }
    setNewLocationInput("");
    showToast("地點已新增");
  };

  const handleDeleteLocation = (locToDelete) => {
    confirmAction(`確定要刪除地點「${locToDelete}」嗎？`, async () => {
      const updatedLocations = locations.filter((l) => l !== locToDelete);
      if (useLocalMode) {
        setLocations(updatedLocations);
        localStorage.setItem(
          "expiry_manager_settings",
          JSON.stringify({ locations: updatedLocations })
        );
      } else if (db) {
        await db
          .collection("settings")
          .doc("global")
          .set({ locations: updatedLocations }, { merge: true });
      }
      showToast("地點已刪除");
    });
  };

  const handleExcelImport = (e) => {
    if (!window.XLSX) return showToast("Excel 套件載入中", "warning");
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = window.XLSX.read(bstr, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = window.XLSX.utils.sheet_to_json(ws);
        const newProducts = [];
        for (const row of data) {
          const parseDate = (val) => {
            if (!val) return "";
            if (val instanceof Date)
              return `${val.getFullYear()}-${String(
                val.getMonth() + 1
              ).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
            return String(val).replace(/\//g, "-").replace(/\./g, "-");
          };
          const product = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            barcode: String(
              row["條碼"] ||
                Math.floor(1000000000000 + Math.random() * 9000000000000)
            ),
            name: String(row["品名"] || "未命名"),
            category: String(row["溫層"] || "").includes("冷凍")
              ? "frozen"
              : "room_temp",
            location: String(row["地點"] || ""),
            receiveDate: parseDate(row["進貨日"]) || getTodayStr(),
            expiryDate: parseDate(row["有效期限"]),
            quantity: Number(row["數量"] || 1),
            reminderDays: Number(row["提醒天數"] || 7),
            hasSecondReminder: false,
            reminderDays2: 3,
            updatedAt: new Date().toISOString(),
          };
          if (product.name && product.expiryDate) newProducts.push(product);
        }

        if (useLocalMode) {
          const updatedProducts = [...products, ...newProducts];
          setProducts(updatedProducts);
          localStorage.setItem(
            `expiry_products_${currentStore}`,
            JSON.stringify(updatedProducts)
          );
        } else if (db && currentStore) {
          const batch = db.batch();
          for (const prod of newProducts)
            batch.set(
              db
                .collection("stores")
                .doc(currentStore)
                .collection("products")
                .doc(prod.id),
              prod
            );
          await batch.commit();
        }
        showToast(`成功匯入 ${newProducts.length} 筆資料`, "success");
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
    if (!window.XLSX) return showToast("匯出套件載入中", "warning");
    try {
      const dataToExport = filteredProducts.map((p) => ({
        商品條碼: p.barcode,
        商品名稱: p.name,
        溫層: p.category === "frozen" ? "冷凍" : "常溫",
        存放地點: p.location,
        進貨日期: p.receiveDate,
        有效期限: p.expiryDate,
        數量: p.quantity,
        提醒天數: p.reminderDays,
      }));
      const ws = window.XLSX.utils.json_to_sheet(dataToExport);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "效期庫存清單");
      window.XLSX.writeFile(
        wb,
        `${currentStore}_庫存報表_${getTodayStr()}.xlsx`
      );
    } catch (e) {
      showToast("匯出發生錯誤", "error");
    }
  };

  const getExpiryStatus = (
    expiryDate,
    reminderDays,
    hasSecondReminder = false,
    reminderDays2 = 3
  ) => {
    const today = new Date(getTodayStr());
    const expDate = new Date(expiryDate);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0)
      return {
        status: "expired",
        label: "已過期",
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        days: Math.abs(diffDays),
      };
    if (
      diffDays <= reminderDays ||
      (hasSecondReminder && diffDays <= reminderDays2)
    )
      return {
        status: "warning",
        label: "即將過期",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        days: diffDays,
      };
    return {
      status: "safe",
      label: "效期正常",
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
      days: diffDays,
    };
  };

  // 計算儀表板狀態數量
  const stats = {
    total: products.length,
    warning: products.filter(
      (p) =>
        getExpiryStatus(
          p.expiryDate,
          p.reminderDays,
          p.hasSecondReminder,
          p.reminderDays2
        ).status === "warning"
    ).length,
    expired: products.filter(
      (p) =>
        getExpiryStatus(
          p.expiryDate,
          p.reminderDays,
          p.hasSecondReminder,
          p.reminderDays2
        ).status === "expired"
    ).length,
  };

  // 1. 過濾邏輯
  let filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    if (!matchSearch) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterLocation !== "all" && p.location !== filterLocation) return false;
    if (filterStatus !== "all") {
      const s = getExpiryStatus(
        p.expiryDate,
        p.reminderDays,
        p.hasSecondReminder,
        p.reminderDays2
      ).status;
      if (s !== filterStatus) return false;
    }
    return true;
  });

  // 2. 排序邏輯
  filteredProducts.sort((a, b) => {
    let result = 0;
    if (sortBy === "name") {
      result = a.name.localeCompare(b.name);
      if (result === 0) {
        result = new Date(a.expiryDate) - new Date(b.expiryDate);
      }
    } else if (sortBy === "expiry") {
      result = new Date(a.expiryDate) - new Date(b.expiryDate);
    } else if (sortBy === "quantity") {
      result = a.quantity - b.quantity;
    }
    return sortOrder === "asc" ? result : -result;
  });

  // 3. 分頁邏輯
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      const hasWarning = dayProducts.some(
        (p) => getExpiryStatus(p.expiryDate, p.reminderDays).status !== "safe"
      );
      const isSelected = selectedCalendarDay === dateStr;

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
            <div
              className={`w-2 h-2 rounded-full mt-1 ${
                hasWarning ? "bg-red-500" : "bg-[#0058a3]"
              }`}
            ></div>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 relative overflow-x-hidden">
      {/* 提示訊息 (Toast) */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-5 w-max max-w-[90vw]">
          {toastMessage.type === "error" ? (
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          )}
          <span className="font-medium text-sm tracking-wide truncate">
            {toastMessage.message}
          </span>
        </div>
      )}

      {/* 確認對話框 (Confirm Modal) */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 border-t-8 border-[#0058a3]">
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
                className="flex-1 py-2.5 rounded-xl bg-[#0058a3] text-white font-bold hover:bg-[#004a89] shadow-md"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分店選擇視窗 */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 relative overflow-hidden border-2 border-[#0058a3]">
            {/* 瑞典配色背景裝飾 */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#FBD914] rounded-bl-full opacity-20 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-[#0058a3] rounded-tr-full opacity-10 pointer-events-none"></div>
            <h2 className="text-2xl font-black text-[#0058a3] flex items-center gap-2 mb-2 relative z-10">
              <Store className="w-7 h-7 text-[#FBD914]" /> 選擇您的分店
            </h2>
            <p className="text-sm text-gray-500 mb-6 font-medium relative z-10">
              請選擇您目前要管理的分店效期庫存
            </p>
            <div className="grid grid-cols-2 gap-3">
              {stores.map((store, index) => (
                <button
                  key={store}
                  onClick={() => {
                    setCurrentStore(store);
                    setIsStoreModalOpen(false);
                  }}
                  className={`p-3 border-2 rounded-2xl font-bold text-lg transition-transform active:scale-95 ${
                    STORE_COLORS[index % STORE_COLORS.length]
                  }`}
                >
                  {store}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 相機掃描全螢幕視窗 */}
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
            className="w-full max-w-lg aspect-square bg-gray-900 overflow-hidden shadow-2xl rounded-2xl border-4 border-[#FBD914]"
          ></div>
          <p className="text-[#FBD914] mt-8 font-black tracking-widest animate-pulse flex items-center gap-2 bg-[#0058a3]/80 px-6 py-2 rounded-full border-2 border-[#FBD914]">
            <Camera className="w-5 h-5" /> 請將條碼對準正方形內
          </p>
        </div>
      )}

      <header className="bg-[#0058a3] shadow-md sticky top-0 z-30 border-b-8 border-[#FBD914] relative overflow-hidden">
        {/* 瑞典元素：背景幾何裝飾 */}
        <div className="absolute -right-4 -top-8 opacity-10 pointer-events-none">
          <div className="w-32 h-32 bg-[#FBD914] rounded-full mix-blend-overlay"></div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="bg-[#FBD914] p-2.5 rounded-2xl text-[#0058a3] shadow-sm transform -rotate-6 hover:rotate-0 transition duration-300">
              {/* 俏皮可愛的笑臉紙箱 SVG */}
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <path d="M8 11h.01"></path>
                <path d="M16 11h.01"></path>
                <path d="M10 15c1.5 1.5 2.5 1.5 4 0"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-xl text-white tracking-wide">
                向即期品說再見
              </h1>
              {currentStore && (
                <span
                  onClick={() => setIsStoreModalOpen(true)}
                  className="text-xs text-blue-200 font-bold cursor-pointer flex items-center gap-1 hover:text-[#FBD914] transition"
                >
                  <Store className="w-3.5 h-3.5" /> {currentStore} (點擊切換)
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => setIsCalendarOpen(true)}
              className="p-2.5 sm:p-3 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition shadow-sm backdrop-blur-sm border border-white/20"
              title="月曆"
            >
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 sm:p-3 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition shadow-sm backdrop-blur-sm border border-white/20"
              title="設定"
            >
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={handleExcelExport}
              className="p-2.5 sm:p-3 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition shadow-sm backdrop-blur-sm border border-white/20"
              title="匯出"
            >
              <FileDown className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <label
              className="p-2.5 sm:p-3 bg-white/10 text-white hover:bg-white/20 rounded-2xl cursor-pointer transition shadow-sm backdrop-blur-sm border border-white/20 flex items-center justify-center"
              title="匯入"
            >
              {isImporting ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <FileUp className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleExcelImport}
              />
            </label>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 sm:px-5 sm:py-3 bg-[#FBD914] text-[#0058a3] hover:bg-[#f0cf13] rounded-2xl shadow-md border-b-4 border-[#d4b50c] font-black transition flex items-center gap-1 active:border-b-0 active:translate-y-1"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" /> 新增
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 新增：效期狀態儀表板 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            onClick={() => setFilterStatus("all")}
            className={`cursor-pointer bg-white py-4 px-2 rounded-2xl border-2 shadow-sm flex flex-col items-center justify-center transition-all ${
              filterStatus === "all"
                ? "border-[#0058a3] ring-4 ring-blue-50"
                : "border-gray-100 hover:border-gray-300"
            }`}
          >
            <span className="text-3xl font-black text-slate-800">
              {stats.total}
            </span>
            <span className="text-xs font-bold text-gray-500 mt-1">
              全部商品
            </span>
          </div>
          <div
            onClick={() => setFilterStatus("warning")}
            className={`cursor-pointer bg-orange-50 py-4 px-2 rounded-2xl border-2 shadow-sm flex flex-col items-center justify-center transition-all ${
              filterStatus === "warning"
                ? "border-orange-500 ring-4 ring-orange-100"
                : "border-orange-100 hover:border-orange-300"
            }`}
          >
            <span className="text-3xl font-black text-orange-600">
              {stats.warning}
            </span>
            <span className="text-xs font-bold text-orange-700 mt-1">
              即將過期
            </span>
          </div>
          <div
            onClick={() => setFilterStatus("expired")}
            className={`cursor-pointer bg-red-50 py-4 px-2 rounded-2xl border-2 shadow-sm flex flex-col items-center justify-center transition-all ${
              filterStatus === "expired"
                ? "border-red-500 ring-4 ring-red-100"
                : "border-red-100 hover:border-red-300"
            }`}
          >
            <span className="text-3xl font-black text-red-600">
              {stats.expired}
            </span>
            <span className="text-xs font-bold text-red-700 mt-1">已過期</span>
          </div>
        </div>

        {/* 過濾與搜尋區塊 */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-2 bg-gray-200 p-1.5 rounded-2xl w-full">
            <button
              onClick={() => setFilterCategory("all")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition ${
                filterCategory === "all"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              全部溫層
            </button>
            <button
              onClick={() => setFilterCategory("room_temp")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition flex justify-center items-center gap-1.5 ${
                filterCategory === "room_temp"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <Sun className="w-4 h-4" /> 常溫
            </button>
            <button
              onClick={() => setFilterCategory("frozen")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition flex justify-center items-center gap-1.5 ${
                filterCategory === "frozen"
                  ? "bg-white text-[#0058a3] shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <Snowflake className="w-4 h-4" /> 冷凍
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜尋名稱或條碼..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-14 py-3 bg-white border-2 border-gray-200 rounded-2xl text-base font-medium focus:border-[#0058a3] outline-none transition shadow-sm"
              />
              <button
                onClick={() => handleStartScanner("search")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-blue-50 text-[#0058a3] rounded-xl hover:bg-blue-100 transition"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              {/* 地點篩選器 */}
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-3 py-3 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold text-slate-600 focus:border-[#0058a3] outline-none transition shadow-sm"
              >
                <option value="all">所有地點</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              {/* 排序選擇器 */}
              <div className="flex bg-white border-2 border-gray-200 rounded-2xl shadow-sm overflow-hidden focus-within:border-[#0058a3] transition">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-3 text-sm font-bold text-slate-600 bg-transparent outline-none border-r border-gray-200"
                >
                  <option value="name">依名稱分組</option>
                  <option value="expiry">依到期日</option>
                  <option value="quantity">依數量</option>
                </select>
                <button
                  onClick={() =>
                    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                  }
                  className="px-3 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
                >
                  <ArrowUpDown
                    className={`w-4 h-4 transition-transform ${
                      sortOrder === "desc" ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading || !currentStore ? (
          <div className="text-center py-20 text-gray-400 font-medium">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#0058a3]" />{" "}
            資料同步中...
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-blue-200">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-100 transform rotate-6">
              <Package className="w-10 h-10 text-[#0058a3] opacity-60" />
            </div>
            <p className="text-lg text-[#0058a3] font-black tracking-wide">
              目前尚無符合的商品紀錄
            </p>
            <p className="text-sm text-gray-400 mt-2 font-bold">
              趕快點擊右上角新增商品吧！
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedProducts.map((product) => {
              const status = getExpiryStatus(
                product.expiryDate,
                product.reminderDays,
                product.hasSecondReminder,
                product.reminderDays2
              );
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${status.border} relative flex flex-col sm:flex-row gap-4 transition hover:shadow-md`}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-2.5 rounded-l-2xl ${status.bg
                      .replace("bg-", "bg-")
                      .replace("-50", "-400")}`}
                  />
                  <div className="flex-1 pl-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">
                        {product.name}
                      </h3>
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
                      <div className="flex items-center gap-2 col-span-2 text-xs bg-gray-50 p-2 rounded-lg border border-gray-200">
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
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-xl ${status.bg} ${status.color} font-black text-sm flex items-center gap-1.5 shadow-sm`}
                    >
                      {status.status === "expired" ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                      {status.status === "expired"
                        ? `已過期 ${status.days} 天`
                        : `剩 ${status.days} 天`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 分頁按鈕 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-3 bg-white border-2 border-gray-200 rounded-2xl text-slate-600 disabled:opacity-50 hover:bg-gray-50 transition shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-black text-slate-700 text-sm">
              第 {currentPage} 頁 / 共 {totalPages} 頁
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-3 bg-white border-2 border-gray-200 rounded-2xl text-slate-600 disabled:opacity-50 hover:bg-gray-50 transition shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      {/* 地點設定視窗 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 border-t-8 border-slate-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
                <Settings className="w-6 h-6 text-slate-500" /> 地點設定
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLocation} className="flex gap-2 mb-6">
              <input
                value={newLocationInput}
                onChange={(e) => setNewLocationInput(e.target.value)}
                placeholder="輸入新地點名稱..."
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-slate-500 outline-none transition"
              />
              <button
                type="submit"
                disabled={!newLocationInput.trim()}
                className="px-5 py-3 bg-slate-700 text-white font-bold rounded-xl disabled:opacity-50 hover:bg-slate-800 transition"
              >
                新增
              </button>
            </form>

            <div className="max-h-[50vh] overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {locations.length === 0 ? (
                <p className="text-center text-gray-400 py-4 font-medium">
                  尚無地點，請由上方新增
                </p>
              ) : (
                locations.map((loc) => (
                  <div
                    key={loc}
                    className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"
                  >
                    <span className="text-sm font-bold text-slate-700">
                      {loc}
                    </span>
                    <button
                      onClick={() => handleDeleteLocation(loc)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 效期日曆視窗 */}
      {isCalendarOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 bg-[#0058a3] text-white flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-[#FBD914]" /> 效期日曆
              </h2>
              <button
                onClick={() => setIsCalendarOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full"
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
                <h3 className="font-black text-lg">
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
                    </span>
                    到期商品
                  </h4>
                  <div className="space-y-2">
                    {products.filter(
                      (p) => p.expiryDate === selectedCalendarDay
                    ).length === 0 ? (
                      <p className="text-gray-400 text-sm">此日無商品到期</p>
                    ) : (
                      products
                        .filter((p) => p.expiryDate === selectedCalendarDay)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border"
                          >
                            <span className="font-bold text-sm text-slate-700 truncate mr-2">
                              {p.name}
                            </span>
                            <span className="text-xs font-black px-2 py-1 bg-white border rounded">
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

      {/* 新增/編輯商品視窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-start pt-[8vh] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col mb-10 shrink-0 overflow-hidden">
            {/* 瑞典國旗配色的極簡裝飾條 */}
            <div className="flex h-3 w-full">
              <div className="bg-[#0058a3] flex-[1_1_0%]"></div>
              <div className="bg-[#FBD914] w-6"></div>
              <div className="bg-[#0058a3] flex-[3_3_0%]"></div>
            </div>

            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="font-black text-[#0058a3] flex items-center gap-2 text-xl tracking-wide">
                <div className="bg-[#FBD914] p-1.5 rounded-lg transform rotate-3">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0058a3"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <path d="M8 11h.01"></path>
                    <path d="M16 11h.01"></path>
                    <path d="M10 15c1.5 1.5 2.5 1.5 4 0"></path>
                  </svg>
                </div>
                {editingId ? "編輯商品" : "向即期品說再見"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition"
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
                  <div className="min-w-0 box-border w-full overflow-hidden">
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
                        placeholder="輸入或掃描"
                        className="w-full min-w-0 px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#0058a3] outline-none transition box-border"
                      />
                      <button
                        type="button"
                        onClick={() => handleStartScanner("form")}
                        className="px-3 py-2.5 bg-blue-50 text-[#0058a3] rounded-xl border border-blue-200 hover:bg-blue-100 transition shrink-0"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 box-border w-full overflow-hidden">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      溫層選擇
                    </label>
                    <div className="flex bg-gray-100 p-1.5 rounded-xl w-full box-border">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: "room_temp" })
                        }
                        className={`flex-1 min-w-0 truncate py-1.5 px-1 text-[11px] font-black rounded-lg flex items-center justify-center gap-1 transition ${
                          formData.category === "room_temp"
                            ? "bg-[#0058a3] text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 flex-shrink-0" /> 常溫
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: "frozen" })
                        }
                        className={`flex-1 min-w-0 truncate py-1.5 px-1 text-[11px] font-black rounded-lg flex items-center justify-center gap-1 transition ${
                          formData.category === "frozen"
                            ? "bg-[#0058a3] text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        <Snowflake className="w-3.5 h-3.5 flex-shrink-0" /> 冷凍
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0 box-border w-full">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      商品名稱
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="請輸入名稱..."
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition box-border"
                    />
                  </div>
                  <div className="min-w-0 box-border w-full">
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

                {/* 解決重疊的日期框：加入 overflow-hidden 與限制邊界 */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
                  <div className="min-w-0 w-full overflow-hidden box-border flex flex-col">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      進貨日期
                    </label>
                    <input
                      type="date"
                      name="receiveDate"
                      required
                      value={formData.receiveDate}
                      onChange={handleInputChange}
                      className="w-full min-w-0 px-2 py-2 border-2 border-gray-200 rounded-xl text-xs sm:text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#0058a3] outline-none transition box-border appearance-none"
                    />
                  </div>
                  <div className="min-w-0 w-full overflow-hidden box-border flex flex-col">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      有效期限
                    </label>
                    <input
                      type="date"
                      name="expiryDate"
                      required
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      className="w-full min-w-0 px-2 py-2 border-2 border-[#0058a3] rounded-xl text-xs sm:text-sm font-black bg-[#0058a3]/5 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition box-border appearance-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
                  <div className="min-w-0 box-border w-full">
                    <label className="block text-[11px] font-black mb-1.5 text-slate-700 truncate">
                      數量
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      required
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="w-full px-2 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition box-border"
                    />
                  </div>
                  <div className="min-w-0 box-border w-full">
                    <label className="block text-[11px] font-black mb-1.5 text-slate-700 truncate">
                      提醒(天)
                    </label>
                    <input
                      type="number"
                      name="reminderDays"
                      min="1"
                      required
                      value={formData.reminderDays}
                      onChange={handleInputChange}
                      className="w-full px-2 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#0058a3] outline-none transition box-border"
                    />
                  </div>
                  <div className="min-w-0 box-border w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-1.5 flex flex-col justify-center">
                    <label className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-slate-700 cursor-pointer mb-1 w-full overflow-hidden">
                      <input
                        type="checkbox"
                        name="hasSecondReminder"
                        checked={formData.hasSecondReminder}
                        onChange={handleInputChange}
                        className="w-3 h-3 accent-[#0058a3] rounded flex-shrink-0"
                      />
                      <span className="truncate">第二提醒</span>
                    </label>
                    {formData.hasSecondReminder ? (
                      <input
                        type="number"
                        name="reminderDays2"
                        min="1"
                        required
                        value={formData.reminderDays2}
                        onChange={handleInputChange}
                        className="w-full px-1 py-1.5 border border-gray-300 rounded-lg text-xs font-bold outline-none bg-white box-border focus:border-[#0058a3]"
                      />
                    ) : (
                      <div className="text-[9px] sm:text-[10px] text-gray-400 font-bold text-center mt-1">
                        停用
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-4 bg-gray-50 flex gap-3 justify-end border-t">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-3 text-slate-600 bg-white border-2 border-gray-200 font-black rounded-xl text-sm hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                type="submit"
                form="productForm"
                className="flex-1 px-6 py-3 bg-[#0058a3] hover:bg-[#004a89] text-[#FBD914] font-black rounded-xl shadow-md flex justify-center items-center gap-2 text-base transition border-b-4 border-[#003d73] active:border-b-0 active:translate-y-1"
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
