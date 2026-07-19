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
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    days: diffDays,
  };
};

const firebaseConfig = {
  apiKey: "AIzaSyAWjwBTH3Wsv7ZSkR73W1o8hULF5uiWIws",
  authDomain: "ikea-36103.firebaseapp.com",
  projectId: "ikea-36103",
  storageBucket: "ikea-36103.firebasestorage.app",
  messagingSenderId: "174471808960",
  appId: "1:174471808960:web:27b2c4fff31422ce1bea25",
  measurementId: "G-LFL5ZDV54C",
};

const STORE_COLORS = [
  "bg-blue-50 text-[#0058a3] border-blue-200 hover:bg-blue-100",
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

  const [currentStore, setCurrentStore] = useState(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(true);
  const stores = ["內湖", "新莊", "新店", "小巨蛋", "青埔", "台中", "高雄"];

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_group");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [newLocationInput, setNewLocationInput] = useState("");

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);

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
      localStorage.getItem(`expiry_settings_${currentStore}`)
    ) || { locations: ["倉庫A", "展示架", "冷藏室", "冷凍庫"] };
    setProducts(localProducts);
    setLocations(localSettings.locations);
    setLoading(false);
  };

  useEffect(() => {
    if (!librariesLoaded || !currentStore) return;

    // 定義取消訂閱函數，保證分店資料完全隔離！
    let unsubscribeProducts = null;
    let unsubscribeSettings = null;

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
        setLoading(true);

        // 綁定當前分店專屬的資料庫監聽
        unsubscribeProducts = firestoreDb
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
            () => {
              showToast("雲端資料讀取錯誤，切換為單機模式", "error");
              loadLocalData();
            }
          );

        unsubscribeSettings = firestoreDb
          .collection("stores")
          .doc(currentStore)
          .collection("settings")
          .doc("config")
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

    // 換分店時，切斷舊分店連線 (避免資料重疊)
    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, [librariesLoaded, currentStore]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [
    searchQuery,
    filterCategory,
    filterLocation,
    filterStatus,
    sortBy,
    sortOrder,
  ]);

  const showToast = (message, type = "info") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const confirmAction = (message, onConfirm) =>
    setConfirmDialog({ message, onConfirm });

  useEffect(() => {
    if (formData.barcode && !editingId) {
      const localMatch = products.find((p) => p.barcode === formData.barcode);
      if (localMatch) {
        setFormData((prev) => ({
          ...prev,
          name: prev.name || localMatch.name,
          category: localMatch.category,
          location: prev.location || localMatch.location,
          reminderDays: localMatch.reminderDays || 7,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const safeReceiveDate = formData.receiveDate || getTodayStr();
    const safeExpiryDate = formData.expiryDate || getTodayStr();

    const dataToSave = {
      ...formData,
      receiveDate: safeReceiveDate,
      expiryDate: safeExpiryDate,
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
      setSelectedIds((prev) => prev.filter((selId) => selId !== id));
      showToast("商品已刪除");
    });
  };

  const handleBulkDelete = () => {
    confirmAction(
      `確定要刪除選取的 ${selectedIds.length} 筆資料嗎？`,
      async () => {
        if (useLocalMode) {
          const updatedProducts = products.filter(
            (p) => !selectedIds.includes(p.id)
          );
          setProducts(updatedProducts);
          localStorage.setItem(
            `expiry_products_${currentStore}`,
            JSON.stringify(updatedProducts)
          );
        } else if (db) {
          const batch = db.batch();
          selectedIds.forEach((id) => {
            const docRef = db
              .collection("stores")
              .doc(currentStore)
              .collection("products")
              .doc(id);
            batch.delete(docRef);
          });
          await batch.commit();
        }
        setSelectedIds([]);
        showToast("批次刪除成功", "success");
      }
    );
  };

  const handleEdit = (product) => {
    setFormData(product);
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = (pageIds) => {
    const isAllSelected = pageIds.every((id) => selectedIds.includes(id));
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const newIds = new Set([...selectedIds, ...pageIds]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    const newLoc = newLocationInput.trim();
    if (!newLoc || locations.includes(newLoc)) return;
    const updatedLocations = [...locations, newLoc];
    if (useLocalMode) {
      setLocations(updatedLocations);
      localStorage.setItem(
        `expiry_settings_${currentStore}`,
        JSON.stringify({ locations: updatedLocations })
      );
    } else if (db) {
      await db
        .collection("stores")
        .doc(currentStore)
        .collection("settings")
        .doc("config")
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
          `expiry_settings_${currentStore}`,
          JSON.stringify({ locations: updatedLocations })
        );
      } else if (db) {
        await db
          .collection("stores")
          .doc(currentStore)
          .collection("settings")
          .doc("config")
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

    let defaultReceiveDate = getTodayStr();
    const fullDateMatch = file.name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    if (fullDateMatch) {
      defaultReceiveDate = `${fullDateMatch[1]}-${fullDateMatch[2]}-${fullDateMatch[3]}`;
    } else {
      const shortDateMatch = file.name.match(/[-_](\d{2})(\d{2})/);
      if (shortDateMatch) {
        const currentYear = new Date().getFullYear();
        defaultReceiveDate = `${currentYear}-${shortDateMatch[1]}-${shortDateMatch[2]}`;
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

        const getVal = (row, keys) => {
          for (const key of keys) {
            if (
              row[key] !== undefined &&
              row[key] !== null &&
              String(row[key]).trim() !== ""
            ) {
              return String(row[key]).trim();
            }
          }
          return "";
        };

        const masterCache = {};
        if (db && !useLocalMode) {
          const masterSnap = await db.collection("master_products").get();
          masterSnap.forEach((doc) => {
            masterCache[doc.id] = doc.data();
          });
        } else {
          products.forEach((p) => {
            masterCache[p.barcode] = p;
          });
        }

        // 終極日期解析器：專治各種 Excel 疑難雜症
        const parseDate = (val) => {
          if (val === undefined || val === null || val === "") return "";

          // 處理 Excel 序號 (如 45123 代表 2023-07-18)
          if (typeof val === "number" && val > 20000 && val < 70000) {
            const d = new Date((val - 25569) * 86400 * 1000);
            return d.toISOString().split("T")[0];
          }
          // 處理已正確解析為 JS Date 物件的日期
          if (val instanceof Date && !isNaN(val)) {
            const d = new Date(val.getTime() - val.getTimezoneOffset() * 60000);
            return d.toISOString().split("T")[0];
          }

          // 處理字串型態 (消除中文年、月、日，斜線轉換)
          let str = String(val)
            .replace(/[\/年.]/g, "-")
            .replace(/日/g, "")
            .trim();

          // 處理 20260719 格式
          const match8 = str.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (match8) return `${match8[1]}-${match8[2]}-${match8[3]}`;

          // 處理 2026-7-1 或 2026-07-01 格式
          const match = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (match)
            return `${match[1]}-${match[2].padStart(
              2,
              "0"
            )}-${match[3].padStart(2, "0")}`;

          return str; // 無法識別時保留原字串
        };

        for (const row of data) {
          const rawBarcode = getVal(row, [
            "貨號",
            "商品條碼",
            "條碼",
            "Item No",
            "Article Number",
          ]);
          const rawName = getVal(row, [
            "商品名稱",
            "品名",
            "商品",
            "Article Name",
            "Name",
          ]);
          const rawExpiry = parseDate(
            getVal(row, [
              "有效期限",
              "到期日",
              "到期日期",
              "效期",
              "Expiry Date",
            ])
          );
          const rawQuantity = getVal(row, [
            "數量(最小單位)",
            "實際數量",
            "數量",
            "總數量",
            "Qty",
          ]);
          const rawLocation = getVal(row, [
            "存放地點",
            "地點",
            "儲位",
            "Location",
            "儲存區",
          ]);
          const rawCategory = getVal(row, ["溫層", "分類"]);

          const barcodeFinal =
            rawBarcode ||
            String(Math.floor(1000000000000 + Math.random() * 9000000000000));

          let categoryFinal = "room_temp";
          if (rawCategory.includes("冷凍")) categoryFinal = "frozen";
          else if (!rawCategory && masterCache[barcodeFinal])
            categoryFinal = masterCache[barcodeFinal].category || "room_temp";

          const product = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            barcode: barcodeFinal,
            name: rawName || "未命名商品",
            category: categoryFinal,
            location: rawLocation,
            receiveDate:
              parseDate(getVal(row, ["進貨日期", "進貨日", "建立日期"])) ||
              defaultReceiveDate,
            expiryDate: rawExpiry,
            quantity: Number(rawQuantity) || 1,
            reminderDays: Number(getVal(row, ["提醒天數", "提醒"]) || 60),
            hasSecondReminder: false,
            reminderDays2: 3,
            updatedAt: new Date().toISOString(),
          };

          if (product.name !== "未命名商品" && product.expiryDate)
            newProducts.push(product);
        }

        if (newProducts.length === 0) {
          showToast("找不到有效資料！請確認檔案欄位", "error");
          return;
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
          for (const prod of newProducts) {
            batch.set(
              db
                .collection("stores")
                .doc(currentStore)
                .collection("products")
                .doc(prod.id),
              prod
            );
            batch.set(
              db.collection("master_products").doc(prod.barcode),
              { name: prod.name, category: prod.category },
              { merge: true }
            );
          }
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

  let filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    if (!matchSearch) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterLocation !== "all" && p.location !== filterLocation) return false;
    if (filterStatus !== "all") {
      const statusObj = getExpiryStatus(
        p.expiryDate,
        p.reminderDays,
        p.hasSecondReminder,
        p.reminderDays2
      );
      if (statusObj.status !== filterStatus) return false;
    }
    return true;
  });

  filteredProducts.sort((a, b) => {
    if (sortBy === "name_group") {
      const nameCmp = a.name.localeCompare(b.name);
      if (nameCmp !== 0) return sortOrder === "asc" ? nameCmp : -nameCmp;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    } else if (sortBy === "expiry") {
      return sortOrder === "asc"
        ? new Date(a.expiryDate) - new Date(b.expiryDate)
        : new Date(b.expiryDate) - new Date(a.expiryDate);
    } else {
      return sortOrder === "asc"
        ? a.quantity - b.quantity
        : b.quantity - a.quantity;
    }
  });

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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  );
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [filteredProducts, totalPages, currentPage]);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
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
          <span className="text-sm font-bold">{d}</span>
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
    <div className="min-h-screen bg-slate-50 font-sans pb-32 relative overflow-x-hidden">
      {/* 提示訊息與全域浮窗 */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-5">
          {toastMessage.type === "error" ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          )}
          <span className="font-bold text-sm tracking-wide">
            {toastMessage.message}
          </span>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 border-t-8 border-[#0058a3]">
            <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
              <Info className="w-6 h-6 text-[#0058a3]" /> 系統提示
            </h3>
            <p className="text-slate-600 mb-6 font-bold">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-slate-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0058a3] text-white font-black hover:bg-[#004a89] shadow-md border-b-4 border-[#004a89] active:border-b-0 active:translate-y-1 transition-all"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-[#0058a3]/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 border-b-8 border-[#FBD914]">
            <h2 className="text-2xl font-black text-[#0058a3] flex items-center gap-2 mb-2">
              <Store className="w-7 h-7 text-[#FBD914]" /> 分店選擇
            </h2>
            <p className="text-sm text-gray-500 mb-6 font-bold">
              請選擇您目前要管理的效期庫存
            </p>
            <div className="grid grid-cols-2 gap-3">
              {stores.map((store, index) => (
                <button
                  key={store}
                  onClick={() => {
                    setCurrentStore(store);
                    setIsStoreModalOpen(false);
                  }}
                  className={`p-3 border-2 rounded-2xl font-black text-lg shadow-sm active:scale-95 transition-transform ${
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

      {isScannerOpen && (
        <div className="fixed inset-0 z-[999] bg-slate-900 flex flex-col items-center justify-center">
          <div className="absolute top-8 right-6 z-10">
            <button
              onClick={handleStopScanner}
              className="bg-white/20 p-3 rounded-full text-white backdrop-blur-md hover:bg-white/30"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
          <div
            id="reader"
            className="w-full max-w-lg aspect-square bg-black overflow-hidden shadow-2xl rounded-3xl border-8 border-[#0058a3]"
          ></div>
          <p className="text-[#FBD914] mt-8 font-black tracking-widest animate-pulse flex items-center gap-2 bg-black/50 px-6 py-3 rounded-full text-lg">
            <Camera className="w-6 h-6" /> 請將條碼置於大框內
          </p>
        </div>
      )}

      {/* 頂部 Header */}
      <header className="bg-[#0058a3] shadow-md sticky top-0 z-30 border-b-8 border-[#FBD914] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="text-[#FBD914]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.29 7 12 12 20.71 7"></polyline>
                <line x1="12" y1="22" x2="12" y2="12"></line>
                <path d="M9 17.5a3 3 0 0 0 6 0"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-xl text-white tracking-widest drop-shadow-sm">
                向即期品說再見
              </h1>
              {currentStore && (
                <span
                  onClick={() => setIsStoreModalOpen(true)}
                  className="text-xs text-blue-200 font-bold cursor-pointer flex items-center gap-1 hover:text-white transition"
                >
                  <Store className="w-3 h-3" /> {currentStore} (切換)
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => setIsCalendarOpen(true)}
              className="p-2.5 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition border border-white/20 backdrop-blur-sm"
            >
              <CalendarDays className="w-6 h-6" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition border border-white/20 backdrop-blur-sm"
            >
              <Settings className="w-6 h-6" />
            </button>
            <button
              onClick={handleExcelExport}
              className="p-2.5 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition border border-white/20 backdrop-blur-sm"
            >
              <FileDown className="w-6 h-6" />
            </button>
            <label className="p-2.5 bg-white/10 text-white hover:bg-white/20 rounded-2xl cursor-pointer transition border border-white/20 backdrop-blur-sm flex items-center justify-center">
              {isImporting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileUp className="w-6 h-6" />
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
              className="px-5 py-2.5 bg-[#FBD914] text-[#0058a3] hover:bg-[#f0cf13] rounded-2xl border-b-4 border-[#d4b609] active:border-b-0 active:translate-y-1 font-black transition-all flex items-center gap-1"
            >
              <Plus className="w-6 h-6" /> 新增
            </button>
          </div>
        </div>
      </header>

      {/* 列表主區域 */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div
            onClick={() => setFilterStatus("all")}
            className={`cursor-pointer transition-all bg-white p-3 rounded-2xl border-2 shadow-sm flex flex-col items-center justify-center ${
              filterStatus === "all"
                ? "ring-4 ring-[#0058a3]/20 border-[#0058a3]"
                : "border-gray-200"
            }`}
          >
            <span className="text-2xl font-black text-slate-800">
              {stats.total}
            </span>
            <span className="text-xs font-bold text-slate-500 mt-1">
              全部商品
            </span>
          </div>
          <div
            onClick={() => setFilterStatus("warning")}
            className={`cursor-pointer transition-all bg-orange-50 p-3 rounded-2xl border-2 shadow-sm flex flex-col items-center justify-center ${
              filterStatus === "warning"
                ? "ring-4 ring-orange-500/20 border-orange-500"
                : "border-orange-100"
            }`}
          >
            <span className="text-2xl font-black text-orange-600">
              {stats.warning}
            </span>
            <span className="text-xs font-bold text-orange-700 mt-1">
              即將過期
            </span>
          </div>
          <div
            onClick={() => setFilterStatus("expired")}
            className={`cursor-pointer transition-all bg-red-50 p-3 rounded-2xl border-2 shadow-sm flex flex-col items-center justify-center ${
              filterStatus === "expired"
                ? "ring-4 ring-red-500/20 border-red-500"
                : "border-red-100"
            }`}
          >
            <span className="text-2xl font-black text-red-600">
              {stats.expired}
            </span>
            <span className="text-xs font-bold text-red-700 mt-1">已過期</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-4 bg-white p-4 rounded-3xl border-2 border-gray-200 shadow-sm">
          <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl w-full">
            <button
              onClick={() => setFilterCategory("all")}
              className={`flex-1 py-2 text-sm font-black rounded-xl transition ${
                filterCategory === "all"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterCategory("room_temp")}
              className={`flex-1 py-2 text-sm font-black rounded-xl transition flex justify-center items-center gap-1 ${
                filterCategory === "room_temp"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <Sun className="w-4 h-4" /> 常溫
            </button>
            <button
              onClick={() => setFilterCategory("frozen")}
              className={`flex-1 py-2 text-sm font-black rounded-xl transition flex justify-center items-center gap-1 ${
                filterCategory === "frozen"
                  ? "bg-white text-[#0058a3] shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <Snowflake className="w-4 h-4" /> 冷凍
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜尋名稱或條碼..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-[#0058a3] outline-none transition"
              />
              <button
                onClick={() => handleStartScanner("search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-50 text-[#0058a3] rounded-xl hover:bg-blue-100 transition"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-gray-50 border-2 border-gray-200 rounded-2xl overflow-hidden shrink-0 focus-within:border-[#0058a3] transition">
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-3 py-3 text-sm font-black text-slate-700 bg-transparent outline-none border-r-2 border-gray-200 appearance-none max-w-[100px] text-center"
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
                className="px-3 py-3 text-sm font-black text-[#0058a3] bg-transparent outline-none border-r-2 border-gray-200 appearance-none text-center"
              >
                <option value="name_group">依名稱分組</option>
                <option value="expiry">依到期日</option>
                <option value="quantity">依數量</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                className="px-3 bg-white text-gray-500 hover:bg-gray-100 transition flex items-center justify-center"
              >
                <ArrowUpDown
                  className={`w-5 h-5 transition-transform ${
                    sortOrder === "desc" ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 整頁全選區塊 */}
        {paginatedProducts.length > 0 && (
          <div
            className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border-2 border-gray-100 mb-4 cursor-pointer hover:bg-gray-50 transition"
            onClick={() =>
              handleSelectAllOnPage(paginatedProducts.map((p) => p.id))
            }
          >
            <label className="flex items-center gap-2 cursor-pointer pointer-events-none">
              <input
                type="checkbox"
                readOnly
                checked={paginatedProducts.every((p) =>
                  selectedIds.includes(p.id)
                )}
                className="w-5 h-5 accent-[#0058a3] rounded"
              />
              <span className="font-black text-slate-700 text-sm">
                全選本頁 (共 {paginatedProducts.length} 筆)
              </span>
            </label>
            {selectedIds.length > 0 && (
              <span className="text-[#0058a3] font-bold text-xs bg-blue-50 border border-blue-200 px-2 py-1 rounded-md tracking-wider">
                總共已選 {selectedIds.length} 項
              </span>
            )}
          </div>
        )}

        {loading || !currentStore ? (
          <div className="text-center py-20 text-[#0058a3] font-bold">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />{" "}
            讀取分店獨立資料中...
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-300">
            <div className="text-[#0058a3] mb-4 flex justify-center opacity-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.29 7 12 12 20.71 7"></polyline>
                <line x1="12" y1="22" x2="12" y2="12"></line>
                <path d="M9 17.5a3 3 0 0 0 6 0"></path>
              </svg>
            </div>
            <p className="text-base text-gray-500 font-black">
              太棒了！該分店條件下查無即期庫存。
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
                  className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
                    status.border
                  } relative flex flex-col sm:flex-row gap-4 transition hover:shadow-md ${
                    selectedIds.includes(product.id)
                      ? "ring-2 ring-[#0058a3]"
                      : ""
                  }`}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-2.5 rounded-l-2xl ${status.bg
                      .replace("bg-", "bg-")
                      .replace("-50", "-400")}`}
                  />
                  <div className="absolute top-4 left-4 z-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="w-5 h-5 accent-[#0058a3] rounded cursor-pointer shadow-sm"
                    />
                  </div>
                  <div className="flex-1 pl-8">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">
                        {product.name}
                      </h3>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-md font-black tracking-widest flex-shrink-0 border ${
                          product.category === "frozen"
                            ? "bg-blue-50 text-[#0058a3] border-blue-200"
                            : "bg-orange-50 text-orange-600 border-orange-200"
                        }`}
                      >
                        {product.category === "frozen" ? "冷凍" : "常溫"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-mono bg-slate-100 inline-flex px-2 py-1 rounded-md border border-slate-200">
                      <Barcode className="w-3.5 h-3.5" /> {product.barcode}
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
                        className="p-2.5 text-[#0058a3] bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2.5 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-xl ${status.bg} ${status.color} font-black text-sm flex items-center gap-1.5 shadow-sm border ${status.border}`}
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

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4 bg-white p-3 rounded-2xl border-2 border-gray-200 shadow-sm w-max mx-auto">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-2 rounded-xl bg-gray-100 text-slate-600 hover:bg-[#0058a3] hover:text-white disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="font-black text-slate-700 min-w-[4rem] text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-2 rounded-xl bg-gray-100 text-slate-600 hover:bg-[#0058a3] hover:text-white disabled:opacity-30 transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </main>

      {/* 懸浮大量刪除列 */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 border-2 border-slate-700 animate-in slide-in-from-bottom-10">
          <span className="font-bold text-sm whitespace-nowrap">
            已選 {selectedIds.length} 項
          </span>
          <div className="w-px h-5 bg-slate-600"></div>
          <button
            onClick={handleBulkDelete}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-black text-sm flex items-center gap-1 shadow-sm transition whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" /> 大量刪除
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="p-2 text-slate-400 hover:text-white rounded-full transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 彈出視窗：設定 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 border-t-8 border-slate-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
                <Settings className="w-6 h-6 text-slate-500" /> {currentStore}{" "}
                地點設定
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
                  尚無地點
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

      {/* 彈出視窗：日曆 */}
      {isCalendarOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 bg-[#0058a3] text-white flex justify-between items-center border-b-4 border-[#FBD914]">
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
                    </span>{" "}
                    到期商品
                  </h4>
                  <div className="space-y-2">
                    {products.filter(
                      (p) => p.expiryDate === selectedCalendarDay
                    ).length === 0 ? (
                      <p className="text-gray-400 text-sm font-bold text-center py-4">
                        此日無商品到期
                      </p>
                    ) : (
                      products
                        .filter((p) => p.expiryDate === selectedCalendarDay)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-200"
                          >
                            <span className="font-bold text-sm text-slate-700 truncate mr-2">
                              {p.name}
                            </span>
                            <span className="text-xs font-black px-2 py-1 bg-white border rounded text-[#0058a3]">
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

      {/* 彈出視窗：新增/編輯表單 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-start pt-[6vh] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col border-t-[12px] border-[#0058a3] mb-10 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 flex">
              <div className="w-1/3 h-full bg-[#FBD914]"></div>
              <div className="w-2/3 h-full bg-[#0058a3]"></div>
            </div>
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="font-black text-[#0058a3] flex items-center gap-2 text-xl tracking-wide">
                <Package className="w-6 h-6 text-[#FBD914]" />{" "}
                {editingId ? "編輯商品" : "新增商品"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 flex-1 custom-scrollbar bg-slate-50/50">
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
                        placeholder="輸入或掃描"
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-white focus:border-[#0058a3] outline-none transition box-border min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleStartScanner("form")}
                        className="px-3 py-2.5 bg-[#FBD914]/20 text-[#0058a3] rounded-xl border border-[#FBD914] hover:bg-[#FBD914]/40 transition shrink-0"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 box-border">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      溫層選擇
                    </label>
                    <div className="flex bg-gray-200/60 p-1.5 rounded-xl">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: "room_temp" })
                        }
                        className={`flex-1 py-1.5 text-xs font-black rounded-lg flex items-center justify-center gap-1 transition ${
                          formData.category === "room_temp"
                            ? "bg-[#FBD914] text-[#0058a3] shadow-sm"
                            : "text-gray-500 hover:bg-white"
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" /> 常溫
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: "frozen" })
                        }
                        className={`flex-1 py-1.5 text-xs font-black rounded-lg flex items-center justify-center gap-1 transition ${
                          formData.category === "frozen"
                            ? "bg-[#0058a3] text-white shadow-sm"
                            : "text-gray-500 hover:bg-white"
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
                      placeholder="請輸入名稱..."
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-white focus:border-[#0058a3] outline-none transition box-border min-w-0"
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-white focus:border-[#0058a3] outline-none transition box-border min-w-0"
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
                  <div className="min-w-0 box-border flex flex-col">
                    <label className="block text-xs font-black mb-1.5 text-slate-700 shrink-0">
                      進貨日期
                    </label>
                    <input
                      type="date"
                      name="receiveDate"
                      required
                      value={formData.receiveDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-white focus:border-[#0058a3] outline-none transition box-border min-w-0"
                    />
                  </div>
                  <div className="min-w-0 box-border flex flex-col">
                    <label className="block text-xs font-black mb-1.5 text-[#0058a3] shrink-0">
                      有效期限
                    </label>
                    <input
                      type="date"
                      name="expiryDate"
                      required
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border-2 border-[#0058a3] rounded-xl text-sm font-black bg-[#0058a3]/5 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition box-border min-w-0"
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-white focus:border-[#0058a3] outline-none transition box-border min-w-0"
                    />
                  </div>
                  <div className="min-w-0 box-border">
                    <label className="block text-xs font-black mb-1.5 text-slate-700">
                      第一提醒(天)
                    </label>
                    <input
                      type="number"
                      name="reminderDays"
                      min="1"
                      required
                      value={formData.reminderDays}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold bg-white focus:border-[#0058a3] outline-none transition box-border min-w-0"
                    />
                  </div>
                  <div className="min-w-0 box-border bg-white border-2 border-gray-200 rounded-xl p-2 flex flex-col justify-center shadow-sm">
                    <label className="flex items-center justify-center gap-1.5 text-[10px] font-black text-slate-700 cursor-pointer mb-1.5">
                      <input
                        type="checkbox"
                        name="hasSecondReminder"
                        checked={formData.hasSecondReminder}
                        onChange={handleInputChange}
                        className="w-3.5 h-3.5 accent-[#0058a3] rounded"
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
                        className="w-full px-2 py-1 border-2 border-gray-200 rounded-lg text-xs font-bold outline-none bg-gray-50 focus:border-[#0058a3] box-border min-w-0 text-center"
                      />
                    ) : (
                      <div className="text-[10px] text-gray-400 font-bold text-center mt-1">
                        已停用
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 bg-white flex gap-3 justify-end rounded-b-3xl border-t border-gray-100">
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
                className="flex-1 px-6 py-3 bg-[#0058a3] hover:bg-[#004a89] text-white font-black rounded-xl shadow-md border-b-4 border-[#004a89] active:border-b-0 active:translate-y-1 flex justify-center items-center gap-2 text-base transition-all"
              >
                <Save className="w-5 h-5 text-[#FBD914]" /> 儲存資料
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
