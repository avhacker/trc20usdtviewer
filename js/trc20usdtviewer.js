// ========== Rate Limiter 和 Retry 機制 ==========
let lastApiCallTime = 0; // 上次 API 呼叫時間
const API_CALL_INTERVAL = 1000; // API 呼叫間隔（毫秒）- 每秒最多 1 次
const MAX_RETRY_ATTEMPTS = 3; // 最大重試次數
const RETRY_DELAY_BASE = 2000; // 重試延遲基礎時間（毫秒）

// Rate limiter: 確保 API 呼叫不會過於頻繁
async function rateLimitedDelay() {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;

    if (timeSinceLastCall < API_CALL_INTERVAL) {
        const delayTime = API_CALL_INTERVAL - timeSinceLastCall;
        console.log(`Rate limiting: 等待 ${delayTime}ms`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
    }

    lastApiCallTime = Date.now();
}

// 帶重試機制的 fetch wrapper
async function fetchWithRetry(url, options = {}, retryCount = 0) {
    // 先執行 rate limiting
    await rateLimitedDelay();

    try {
        const response = await fetch(url, options);

        // 如果是 429 錯誤（Too Many Requests），進行重試
        if (response.status === 429 && retryCount < MAX_RETRY_ATTEMPTS) {
            const retryDelay = RETRY_DELAY_BASE * Math.pow(2, retryCount); // 指數退避
            console.log(`收到 429 錯誤，${retryDelay}ms 後進行第 ${retryCount + 1} 次重試...`);

            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchWithRetry(url, options, retryCount + 1);
        }

        return response;
    } catch (error) {
        // 網路錯誤也可以重試
        if (retryCount < MAX_RETRY_ATTEMPTS) {
            const retryDelay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
            console.log(`網路錯誤，${retryDelay}ms 後進行第 ${retryCount + 1} 次重試...`, error);

            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchWithRetry(url, options, retryCount + 1);
        }

        throw error;
    }
}

// ========== 全域變數 ==========
let isPaused = false; // 用于控制是否暂停
let totalRecords = 0; // 已加载的交易记录数
let timeDisplayMode = "local"; // 時間顯示模式: local, utc, age
let ageUpdateInterval = null; // 用于定期更新經過時間的計時器
const DEFAULT_START_TIME = "2019-01-01 00:00:00"; // 預設開始時間
const DEFAULT_END_TIME = "2029-01-01 00:00:00"; // 預設結束時間

// 切換圖標的 SVG
const toggleIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 85.208 122.882" style="vertical-align: middle; margin-left: 4px;"><g><path fill-rule="evenodd" clip-rule="evenodd" d="M57.121,122.882l28.087-29.215L67.13,93.665V67.004v-0.506V41.932H47.111V66.5 l0,0v27.165l-18.081,0.002L57.121,122.882L57.121,122.882z M28.09,0l28.086,29.215l-18.078,0.002v26.661v0.505V80.95H18.08V56.382 l0,0V29.217L0,29.215L28.09,0L28.09,0z"/></g></svg>`;
let maxRecords = 10000; // 最大记录数
let params = { limit: 200 }; // 当前API查询参数
let allTransactions = []; // 已加载的所有交易数据
let sortField = null; // 当前排序字段
let sortOrder = null; // 当前排序方向（asc/desc）
let isLoadingComplete = false; // 是否已完成加载
let reachedMaxRecords = false; // 是否已達到最大記錄數
let ignoreMaxRecords = false; // 是否忽略最大記錄數限制
let currentLanguage = ""; // 當前語言

// 語言包
const translations = {
    "zh-TW": {
        title: "TRC20 USDT 交易紀錄查詢",
        inputPlaceholder: "輸入要查詢的 TRC20 錢包地址",
        minAmountPlaceholder: "最小金額",
        matchedTransactionsLabel: "過濾後的資金",
        totalReceived: "總收款",
        totalReceivedLabel: "總收款",
        totalSent: "總付款",
        totalSentLabel: "總付款",
        peerAddressInclude: "包含",
        peerAddressExclude: "排除",
        maxAmountPlaceholder: "最大金額",
        walletAddressLabel: "地址",
        walletBalanceLabel: "錢包餘額",
        energyLabel: "總可用能量",
        query: "查詢",
        viewOnTronscan: "在 Tronscan 查看",
        minAmount: "最小:",
        maxAmount: "最大:",
        peerAddress: "地址:",
        peerAddressPlaceholder: "對方地址關鍵字",
        type: "類型:",
        typeAll: "全部",
        typeReceived: "收款",
        typeSent: "付款",
        clear: "清除過濾條件",
        waiting: "等待查詢...",
        loading: "已載入 {0} 筆記錄",
        loadingLimit: "已載入 {0} 筆記錄 (已達預設上限)",
        loadingContinue: "已載入 {0} 筆記錄 (繼續載入中...)",
        complete: "載入完成，共 {0} 筆記錄",
        pause: "暫停載入",
        continue: "繼續載入",
        loadComplete: "載入完成",
        time: "時間",
        timeLocal: "本地時間",
        timeUTC: "UTC 時間",
        timeAge: "經過時間",
        timeToggleHint: "點擊可切換時間模式",
        ageDay: "{0}天{1}小時",
        ageHour: "{0}小時{1}分",
        ageMinute: "{0}分{1}秒",
        ageSecond: "{0}秒",
        ageSuffix: "之前",
        startTime: "開始時間",
        endTime: "結束時間",
        transactionId: "交易 ID",
        action: "類型",
        amount: "金額",
        copyTooltip: "複製",
        tronscanTooltip: "Tronscan 網站連結",
        peerAddressHeader: "對方地址",
        footer: " 2025 TRC20 USDT 交易紀錄查詢 | 使用 <a href=\"https://picocss.com\" target=\"_blank\">Pico.css</a> | <a href=\"mailto:avhacker@gmail.com\">avhacker@gmail.com</a>",
        filteredTotalReceived: "過濾後總收款",
        filteredTotalSent: "過濾後總付款",
        copySuccess: "已複製！",
        loadingInProgress: "正在載入交易記錄...",
        loadingPaused: "載入已暫停",
        loadingCompleted: "所有交易記錄已載入完成",
        loadingLimitReached: "已達到預設載入上限 ({0} 筆)，點擊「繼續載入」可載入更多記錄",
        btnToday: "今天",
        btn3Days: "3天內",
        btnWeek: "一週內",
        timeToggleTitle: "指定時間"
    },
    "en": {
        title: "TRC20 USDT Transaction History",
        inputPlaceholder: "Enter TRC20 wallet address",
        minAmountPlaceholder: "Min amount",
        matchedTransactionsLabel: "Filtered transactions",
        totalReceived: "Total Received",
        totalReceivedLabel: "Total Received",
        totalSent: "Total Sent",
        totalSentLabel: "Total Sent",
        peerAddressInclude: "Include",
        peerAddressExclude: "Exclude",
        maxAmountPlaceholder: "Max amount",
        walletAddressLabel: "Address",
        walletBalanceLabel: "Wallet balance",
        energyLabel: "Total available energy",
        query: "Query",
        viewOnTronscan: "View on Tronscan",
        minAmount: "Min:",
        maxAmount: "Max:",
        peerAddress: "Address:",
        peerAddressPlaceholder: "Peer address keyword",
        type: "Type:",
        typeAll: "All",
        typeReceived: "Received",
        typeSent: "Sent",
        clear: "Clear filters",
        waiting: "Waiting for query...",
        loading: "Loaded {0} records",
        loadingLimit: "Loaded {0} records (reached default limit)",
        loadingContinue: "Loaded {0} records (loading more...)",
        complete: "Complete. Total records: {0}",
        pause: "Pause",
        continue: "Continue",
        loadComplete: "Complete",
        time: "Time",
        timeLocal: "Local Time",
        timeUTC: "UTC Time",
        timeAge: "Age",
        timeToggleHint: "Click to toggle time display mode",
        ageDay: "{0}d {1}h",
        ageHour: "{0}h {1}m",
        ageMinute: "{0}m {1}s",
        ageSecond: "{0}s",
        ageSuffix: " ago",
        startTime: "Start Time",
        endTime: "End Time",
        transactionId: "Transaction ID",
        action: "Type",
        amount: "Amount",
        copyTooltip: "Copy",
        tronscanTooltip: "Tronscan link",
        peerAddressHeader: "Peer Address",
        footer: " 2025 TRC20 USDT Transaction Viewer | Powered by <a href=\"https://picocss.com\" target=\"_blank\">Pico.css</a> | <a href=\"mailto:avhacker@gmail.com\">avhacker@gmail.com</a>",
        filteredTotalReceived: "Filtered Total Received",
        filteredTotalSent: "Filtered Total Sent",
        copySuccess: "Copied!",
        loadingInProgress: "Loading transactions...",
        loadingPaused: "Loading paused",
        loadingCompleted: "All transactions loaded",
        loadingLimitReached: "Reached default limit ({0} records). Click 'Continue' to load more",
        btnToday: "Today",
        btn3Days: "Within 3 Days",
        btnWeek: "Within 1 Week",
        timeToggleTitle: "Specify Time"
    }
};

// 格式化字符串，替换 {0}, {1} 等占位符
function formatString(str, ...args) {
    return str.replace(/{(\d+)}/g, (match, number) => {
        return typeof args[number] !== 'undefined' ? args[number] : match;
    });
}

// 更新載入狀態訊息
function updateLoadingStatusMessage(statusType, ...args) {
    const messageElement = document.getElementById("loadingStatusMessage");
    if (!messageElement) return;

    const t = translations[currentLanguage];
    let message = "";
    let shouldShow = false;

    switch (statusType) {
        case "loading":
            message = t.loadingInProgress;
            shouldShow = true;
            break;
        case "paused":
            message = t.loadingPaused;
            shouldShow = true;
            break;
        case "completed":
            message = t.loadingCompleted;
            shouldShow = true;
            break;
        case "limitReached":
            message = formatString(t.loadingLimitReached, ...args);
            shouldShow = true;
            break;
        case "hide":
            shouldShow = false;
            break;
        default:
            shouldShow = false;
    }

    if (shouldShow) {
        messageElement.textContent = message;
        messageElement.style.display = "block";
    } else {
        messageElement.style.display = "none";
    }
}

// 获取当前用户语言并载入对应语言
function detectLanguage() {
    // 首先检查 URL 参数是否有指定语言
    const urlParams = new URLSearchParams(window.location.search);
    let lang = urlParams.get("lang");

    // 如果没有指定，则使用浏览器语言
    if (!lang) {
        const browserLang = navigator.language || navigator.userLanguage;
        // 检查是否为繁体中文
        if (browserLang.startsWith("zh") && (browserLang.includes("TW") || browserLang.includes("HK"))) {
            lang = "zh-TW";
        } else {
            lang = "en";
        }
    }

    // 确保语言包中有此语言，否则使用英文
    if (!translations[lang]) {
        lang = "en";
    }

    currentLanguage = lang;
    applyTranslations();
}

// 应用翻译到页面元素
function applyTranslations() {
    const t = translations[currentLanguage];
    const urlParams = new URLSearchParams(window.location.search);

    // 更新页面标题
    document.title = t.title;

    // 更新錢包餘額標籤 (不包含地址，地址將在獲取餘額時更新)
    const address = urlParams.get("address") || "";
    updateWalletBalanceLabel(address);
    document.getElementById("walletAddressLabel").textContent = t.walletAddressLabel;
    document.getElementById("energyLabel").textContent = t.energyLabel;
    document.getElementById("matchedTransactionsLabel").textContent = t.matchedTransactionsLabel;
    document.getElementById("totalReceivedLabel").textContent = t.totalReceivedLabel;
    document.getElementById("totalSentLabel").textContent = t.totalSentLabel;

    // 更新清除過濾按鈕
    document.getElementById("clearFiltersButton").textContent = t.clear;

    // 更新表单元素
    document.getElementById("addressInput").placeholder = t.inputPlaceholder;
    document.getElementById("queryButton").textContent = t.query;

    // 更新筛选条件
    document.getElementById("minAmount").placeholder = t.minAmountPlaceholder;
    document.getElementById("maxAmount").placeholder = t.maxAmountPlaceholder;
    document.getElementById("peerAddressFilter").placeholder = t.peerAddressPlaceholder;

    // 更新快速按鈕文字
    if (document.getElementById("btnToday")) document.getElementById("btnToday").textContent = t.btnToday;
    if (document.getElementById("btn3Days")) document.getElementById("btn3Days").textContent = t.btn3Days;
    if (document.getElementById("btnWeek")) document.getElementById("btnWeek").textContent = t.btnWeek;

    // 更新時間切換按鈕的 title
    if (document.getElementById("startTimeToggle")) document.getElementById("startTimeToggle").title = t.timeToggleTitle;
    if (document.getElementById("endTimeToggle")) document.getElementById("endTimeToggle").title = t.timeToggleTitle;

    // 更新地址過濾類型選項
    const peerAddressFilterTypeSelect = document.getElementById("peerAddressFilterType");
    if (peerAddressFilterTypeSelect) {
        // 清空現有選項
        peerAddressFilterTypeSelect.innerHTML = '';

        // 重新創建選項，確保文字來自翻譯
        const includeOption = document.createElement('option');
        includeOption.value = 'include';
        includeOption.textContent = t.peerAddressInclude;

        const excludeOption = document.createElement('option');
        excludeOption.value = 'exclude';
        excludeOption.textContent = t.peerAddressExclude;

        peerAddressFilterTypeSelect.appendChild(includeOption);
        peerAddressFilterTypeSelect.appendChild(excludeOption);

        // 恢復之前的選擇
        peerAddressFilterTypeSelect.value = urlParams.get("peerType") || "include";
    }

    // 更新交易類型過濾選項
    const actionFilterSelect = document.getElementById("actionFilter");
    if (actionFilterSelect) {
        // 清空現有選項
        actionFilterSelect.innerHTML = '';

        // 重新創建選項，確保文字來自翻譯
        const allOption = document.createElement('option');
        allOption.value = 'both';
        allOption.textContent = t.typeAll;

        const receivedOption = document.createElement('option');
        receivedOption.value = 'received';
        receivedOption.textContent = t.typeReceived;

        const sentOption = document.createElement('option');
        sentOption.value = 'sent';
        sentOption.textContent = t.typeSent;

        actionFilterSelect.appendChild(allOption);
        actionFilterSelect.appendChild(receivedOption);
        actionFilterSelect.appendChild(sentOption);

        // 恢復之前的選擇
        actionFilterSelect.value = urlParams.get("action") || "both";
    }

    // 更新表格標題欄位
    const tableHeaders = document.querySelectorAll("table thead th");
    if (tableHeaders.length > 0) {
        // 交易 ID
        if (tableHeaders[1]) {
            tableHeaders[1].textContent = t.transactionId;
        }

        // 類型
        if (tableHeaders[2]) {
            const actionTextSpan = tableHeaders[2].querySelector(".text-content");
            if (actionTextSpan) {
                actionTextSpan.textContent = t.action;
            }
        }

        // 金額
        if (tableHeaders[3]) {
            const valueTextSpan = tableHeaders[3].querySelector(".text-content");
            if (valueTextSpan) {
                valueTextSpan.textContent = t.amount;
            }
        }

        // 對方地址
        if (tableHeaders[4]) {
            tableHeaders[4].textContent = t.peerAddressHeader;
        }
    }

    // 更新下拉选单选项
    // 更新页面尾
    document.querySelector("footer small").innerHTML = t.footer;

    // 更新 Tronscan 链接文字
    if (document.getElementById("addressLink")) {
        document.getElementById("addressLink").textContent = t.viewOnTronscan;
    }
}

// 更新状态文字，考虑语言
function updateStatusText(key, ...args) {
    const t = translations[currentLanguage];
    const statusText = formatString(t[key], ...args);
    document.getElementById("status").textContent = statusText;
}

function updateURLParams() {
    const urlParams = new URLSearchParams(window.location.search);

    const minAmount = parseFloat(document.getElementById("minAmount").value) || 1.0;
    const maxAmount = document.getElementById("maxAmount").value;
    const peerAddressFilter = document.getElementById("peerAddressFilter").value;
    const peerAddressFilterType = document.getElementById("peerAddressFilterType").value;
    const actionFilter = document.getElementById("actionFilter").value;

    const startDate = document.getElementById("startDate").value;
    const startTime = document.getElementById("startTime").value;
    const endDate = document.getElementById("endDate").value;
    const endTime = document.getElementById("endTime").value;

    urlParams.set("min", minAmount);
    if (maxAmount) urlParams.set("max", maxAmount); else urlParams.delete("max");
    if (peerAddressFilter) {
        urlParams.set("peer", peerAddressFilter);
        urlParams.set("peerType", peerAddressFilterType);
    } else {
        urlParams.delete("peer");
        urlParams.delete("peerType");
    }
    if (actionFilter) urlParams.set("action", actionFilter);

    // 保存時間過濾器的值到 URL 參數
    // 如果有選日期，則組合日期和時間
    if (startDate) {
        urlParams.set("startTime", `${startDate} ${startTime || "00:00:00"}`);
    } else {
        urlParams.delete("startTime");
    }

    if (endDate) {
        urlParams.set("endTime", `${endDate} ${endTime || "00:00:00"}`);
    } else {
        urlParams.delete("endTime");
    }

    if (sortField) urlParams.set("sortField", sortField);
    if (sortOrder) urlParams.set("sortOrder", sortOrder);

    history.replaceState(null, "", "?" + urlParams.toString());
}

function loadURLParams() {
    const urlParams = new URLSearchParams(window.location.search);

    document.getElementById("minAmount").value = urlParams.get("min") || 1.0;
    document.getElementById("maxAmount").value = urlParams.get("max") || "";
    document.getElementById("peerAddressFilter").value = urlParams.get("peer") || "";
    document.getElementById("peerAddressFilterType").value = urlParams.get("peerType") || "include";
    document.getElementById("actionFilter").value = urlParams.get("action") || "both";

    // 從 URL 載入時間過濾器的參數
    const startTimeStr = urlParams.get("startTime");
    if (startTimeStr) {
        const [date, time] = startTimeStr.split(" ");
        document.getElementById("startDate").value = date;
        if (time && time !== "00:00:00") {
            document.getElementById("startTime").value = time;
            document.getElementById("startTimeContainer").style.display = "block";
        }
    }

    const endTimeStr = urlParams.get("endTime");
    if (endTimeStr) {
        const [date, time] = endTimeStr.split(" ");
        document.getElementById("endDate").value = date;
        if (time && time !== "00:00:00") {
            document.getElementById("endTime").value = time;
            document.getElementById("endTimeContainer").style.display = "block";
        }
    }

    sortField = urlParams.get("sortField") || null;
    sortOrder = urlParams.get("sortOrder") || null;
}

function updateSortIcons() {
    const sortableHeaders = document.querySelectorAll("th.sortable");
    sortableHeaders.forEach(header => {
        const field = header.getAttribute("data-field");
        const sortIcon = header.querySelector(".sort-icon");
        if (sortIcon) { // 增加檢查，確保 sortIcon 不為 null
            if (field === sortField) {
                sortIcon.textContent = sortOrder === "asc" ? "🔼" : "🔽";
            } else {
                sortIcon.textContent = "";
            }
        }
    });
}

// 快速設定時間範圍
function setQuickTimeRange(days) {
    const now = new Date();
    // 根據目前的 timeDisplayMode 判斷使用 UTC 或本地時間來計算日期
    // 這裡我們以日期的 00:00:00 為基準

    // 計算起始日期
    const targetDate = new Date();
    targetDate.setDate(now.getDate() - days);

    // 格式化為 YYYY-MM-DD
    const formatDate = (date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

    // 若 timeDisplayMode 為 utc，應使用 UTC 時間計算
    // 但 <input type="date"> 始終使用本地時間解釋輸入的值
    // 為了簡單起見，我們這裡統一將「今天」「三天內」解釋為本地時區的日期範圍
    // 畢竟 input date 本身沒有時區概念

    document.getElementById("startDate").value = formatDate(targetDate);
    document.getElementById("startTime").value = "00:00:00";

    // 結束日期留空 (表示查到最新)
    document.getElementById("endDate").value = "";
    document.getElementById("endTime").value = "00:00:00";

    // 隱藏時間選擇器，除非用戶想改
    document.getElementById("startTimeContainer").style.display = "none";
    document.getElementById("endTimeContainer").style.display = "none";

    // 自動觸發查詢
    sortAndFilterTransactions();
}

function toggleTimeInput(type) {
    const container = document.getElementById(type + "TimeContainer");
    if (container.style.display === "none") {
        container.style.display = "block";
    } else {
        container.style.display = "none";
        // 隱藏時重置為 00:00:00
        document.getElementById(type + "Time").value = "00:00:00";
    }
}

function sortAndFilterTransactions() {
    const minAmount = parseFloat(document.getElementById("minAmount").value);
    const maxAmount = parseFloat(document.getElementById("maxAmount").value || null);
    const peerAddressFilter = document.getElementById("peerAddressFilter").value.toLowerCase() || null;
    const peerAddressFilterType = document.getElementById("peerAddressFilterType").value;
    const actionFilter = document.getElementById("actionFilter").value || "both";

    // 取得新的日期時間輸入
    const startDateVal = document.getElementById("startDate").value;
    const startTimeVal = document.getElementById("startTime").value || "00:00:00";
    const endDateVal = document.getElementById("endDate").value;
    const endTimeVal = document.getElementById("endTime").value || "00:00:00";

    let startTime = null;
    let endTime = null;

    if (startDateVal) {
        startTime = new Date(`${startDateVal}T${startTimeVal}`).getTime();
    }

    if (endDateVal) {
        endTime = new Date(`${endDateVal}T${endTimeVal}`).getTime();
    }

    let filteredTransactions = allTransactions.filter(tx => {
        // 根據用戶選擇的過濾類型（包含/排除）來判斷地址是否符合條件
        let isPeerAddressValid = true;
        if (peerAddressFilter) {
            const addressIncludesPattern = tx.peerAddress.toLowerCase().includes(peerAddressFilter);
            if (peerAddressFilterType === "include") {
                isPeerAddressValid = addressIncludesPattern;
            } else { // exclude
                isPeerAddressValid = !addressIncludesPattern;
            }
        }

        // 時間過濾判斷
        let isTimeValid = true;
        if (startTime) {
            isTimeValid = isTimeValid && tx.timestamp >= startTime;
        }
        if (endTime) {
            isTimeValid = isTimeValid && tx.timestamp <= endTime;
        }

        const isActionValid = actionFilter === "both" || tx.action === actionFilter;
        return (!minAmount || tx.value >= minAmount) &&
            (!maxAmount || tx.value <= maxAmount) &&
            isPeerAddressValid &&
            isActionValid &&
            isTimeValid;
    });

    // 計算過濾後的總收款量和總付款量
    let totalReceived = 0;
    let totalSent = 0;

    filteredTransactions.forEach(tx => {
        if (tx.action === "received") {
            totalReceived += tx.value;
        } else if (tx.action === "sent") {
            totalSent += tx.value;
        }
    });

    // 將計算結果存儲為全局變數，以便在其他函數中使用
    window.filteredTotalReceived = totalReceived;
    window.filteredTotalSent = totalSent;

    if (sortField) {
        filteredTransactions.sort((a, b) => {
            if (sortOrder === "asc") {
                return a[sortField] > b[sortField] ? 1 : -1;
            } else {
                return a[sortField] < b[sortField] ? 1 : -1;
            }
        });
    }

    updateURLParams(); // 将筛选和排序条件写回 URL
    displayFilteredTransactions(filteredTransactions);
}

function displayFilteredTransactions(transactions) {
    const table = document.querySelector("table tbody");
    while (table.rows.length > 0) {
        table.deleteRow(0);
    }

    transactions.forEach(tx => {
        const row = table.insertRow();

        const timestampCell = row.insertCell();
        timestampCell.className = "timestamp-cell";
        timestampCell.dataset.timestamp = tx.timestamp;
        updateTimestampDisplay(timestampCell, tx.timestamp);

        const transactionIdCell = row.insertCell();
        transactionIdCell.className = "transaction-cell";
        const transactionLink = document.createElement("a");
        transactionLink.href = `https://tronscan.org/#/transaction/${tx.transactionId}`;
        transactionLink.textContent = tx.transactionId.substring(0, 6) + "..." + tx.transactionId.substring(tx.transactionId.length - 6);
        transactionLink.title = tx.transactionId;
        transactionLink.target = "_blank";
        transactionLink.className = "transaction-link";
        const copyIcon = document.createElement("span");
        copyIcon.className = "copy-icon";
        copyIcon.innerHTML = getCopyIconSvg();
        copyIcon.title = translations[currentLanguage].copyTooltip;
        copyIcon.onclick = (e) => {
            copyToClipboard(tx.transactionId, copyIcon, e);
        };
        transactionIdCell.appendChild(transactionLink);
        transactionIdCell.appendChild(copyIcon);

        const actionCell = row.insertCell();
        actionCell.textContent = tx.action === "received" ?
            (currentLanguage === "zh-TW" ? "收款" : "Received") :
            (currentLanguage === "zh-TW" ? "付款" : "Sent");
        actionCell.className = tx.action === "received" ? "action-received" : "action-sent";

        const valueCell = row.insertCell();
        valueCell.textContent = tx.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
        valueCell.className = "amount-cell";
        valueCell.style.cursor = "pointer";
        valueCell.title = "點擊複製金額";
        valueCell.onclick = function (e) {
            copyToClipboard(tx.value.toString(), this, e);
        };

        const peerAddressCell = row.insertCell();
        peerAddressCell.className = "address-cell";
        const peerAddressLink = document.createElement("a");
        peerAddressLink.href = "#";
        peerAddressLink.textContent = tx.peerAddress.substring(0, 6) + "..." + tx.peerAddress.substring(tx.peerAddress.length - 6);
        peerAddressLink.title = tx.peerAddress;
        peerAddressLink.onclick = () => {
            document.querySelector("input[name='address']").value = tx.peerAddress;
            queryButton.click();
        };
        peerAddressLink.className = "address-link";
        const copyIcon2 = document.createElement("span");
        copyIcon2.className = "copy-icon";
        copyIcon2.innerHTML = getCopyIconSvg();
        copyIcon2.title = translations[currentLanguage].copyTooltip;
        copyIcon2.onclick = (e) => {
            copyToClipboard(tx.peerAddress, copyIcon2, e);
        };
        peerAddressCell.appendChild(peerAddressLink);
        peerAddressCell.appendChild(copyIcon2);

        // 創建 Tronscan 圖標並放在 copyIcon2 後面
        const tronscanIconLink = document.createElement("a");
        tronscanIconLink.href = `https://tronscan.org/#/address/${tx.peerAddress}`;
        tronscanIconLink.target = "_blank";
        tronscanIconLink.className = "tronscan-icon";
        tronscanIconLink.style.marginLeft = "5px";
        tronscanIconLink.title = translations[currentLanguage].tronscanTooltip;
        const tronscanIcon = document.createElement("img");
        tronscanIcon.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMTQ2IDM2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZyBjbGlwLXBhdGg9InVybCgjY2xpcDApIj4KPHBhdGggZD0iTTAgNi45ODM4TDE3LjM4ODggMEwzNC44MTUzIDYuOTgzOEwxNy4zNyAxMy45ODY0TDAgNi45ODM4WiIgZmlsbD0iI0MyMzYzMSIvPgo8cGF0aCBkPSJNMS40OTg1NSA2Ljk5MzI5VjI4LjYzMjdMMCAyOC4wMjk1VjYuOTkzMjlIMS40OTg1NVoiIGZpbGw9IiNDMjM2MzEiLz4KPHBhdGggZD0iTTE4LjE1MjIgMTMuMDQzOVYzNC43Nzc2TDE3LjQ3MzYgMzUuMDUwOUwxNi42NjMxIDM0LjcyMVYxMy4wNDM5SDE4LjE1MjJaIiBmaWxsPSIjQzIzNjMxIi8+CjxwYXRoIGQ9Ik0xOS40ODExIDM0LjI0MDVMMTguMTUyMiAzNC43Nzc3TDE3LjQ3MzYgMzUuMDUxTDE2LjY2MzEgMzQuNzIxMUwxNS40NjYxIDM0LjI0MDVMMS40OTg1NSAyOC42MzI3TDAgMjguMDI5NVYyNi40MTc4TDEuNDk4NTUgMjcuMDIxTDE2LjY2MzEgMzMuMTA5NUwxNy40NzM2IDMzLjQzOTNMMTguMTUyMiAzMy43MTI3TDE5LjQ4MTEgMzQuMjQwNVoiIGZpbGw9IiNDMjM2MzEiLz4KPHBhdGggZD0iTTAgNi45ODM3NlY4LjYwNDg0TDE4LjE1MjIgMTUuODkwMlYxNC4yNzg2TDAgNi45ODM3NloiIGZpbGw9IiNDMjM2MzEiLz4KPHBhdGggZD0iTTQzLjA5MDMgMy42NTY3NEwxNy4yODUyIDE0LjAyNEwxNy44NDEyIDE1LjQwOTVMNDMuMDkwMyA1LjI3NzgxVjMuNjU2NzRaIiBmaWxsPSIjQzIzNjMxIi8+CjxwYXRoIGQ9Ik00My4wOTAzIDEwLjE2TDE3LjI4NTIgMjAuNTE3OUwxNy44NDEyIDIxLjkxMjhMNDMuMDkwMyAxMS43NzE3VjEwLjE2WiIgZmlsbD0iI0MyMzYzMSIvPgo8cGF0aCBkPSJNNDMuMDkwMyAxNi42NTM3TDE3LjI4NTIgMjcuMDIxTDE3Ljg0MTIgMjguNDA2NEw0My4wOTAzIDE4LjI3NDhWMTYuNjUzN1oiIGZpbGw9IiNDMjM2MzEiLz4KPHBhdGggZD0iTTQzLjA5MDIgMjMuMTU2N1YyNC43Njg0TDE5LjQ4MSAzNC4yNDAzTDE4LjE1MjEgMzQuNzc3NkwxNy40NzM2IDM1LjA1MDlMMTYuNjYzIDM0LjcyMUwxNS40NjYxIDM0LjI0MDNMMTYuNjYzIDMzLjc1OTdMMTcuNDczNiAzMy40MzkyTDE4LjE1MjEgMzMuMTY1OUw0My4wOTAyIDIzLjE1NjdaIiBmaWxsPSIjQzIzNjMxIi8+CjxwYXRoIGQ9Ik01NC41NzkyIDEzLjYxODlINTAuNzUyN1YxMS42NjhINjEuMTJWMTMuNjE4OUg1Ny4zMDI5VjIzLjM2NDJINTQuNTc5MlYxMy42MTg5WiIgZmlsbD0iIzEwMTAxMCIvPgo8cGF0aCBkPSJNNzAuMjYyMSAyMy4zODNMNjcuMzg3NSAxOC44NDk3SDY1LjUwMjZWMjMuMzczNkg2Mi44MzUzVjExLjY2OEg2Ny41NDc3QzcwLjM3NTIgMTEuNjY4IDcyLjU5IDEyLjUxNjIgNzIuNTkgMTUuMTY0NkM3Mi42MDUyIDE1LjkyNTYgNzIuMzYwNCAxNi42NjkxIDcxLjg5NiAxNy4yNzIyQzcxLjQzMTcgMTcuODc1NCA3MC43NzU1IDE4LjMwMjIgNzAuMDM1OSAxOC40ODIxTDczLjI5NjkgMjMuMzgzSDcwLjI2MjFaTTY1LjU0OTcgMTcuMDExOEg2Ny4yOTMzQzY5LjAwODYgMTcuMDExOCA2OS45NTExIDE2LjM4OTggNjkuOTUxMSAxNS4xMjY5QzY5Ljk1MTEgMTMuODY0IDY5LjAwODYgMTMuNDU4NyA2Ny4yOTMzIDEzLjQ1ODdINjUuNTIxNEw2NS41NDk3IDE3LjAxMThaIiBmaWxsPSIjMTAxMDEwIi8+CjxwYXRoIGQ9Ik03NC40NTYyIDE3LjM4ODhDNzQuNDU2MiAxMy42MTg5IDc2LjkwNjYgMTEuNDUxMiA4MC40NTk4IDExLjQ1MTJDODQuMDEzIDExLjQ1MTIgODYuNDYzNCAxMy42NDcyIDg2LjQ2MzQgMTcuMzg4OEM4Ni40NjM0IDE4LjE3NzIgODYuMzA4MSAxOC45NTc5IDg2LjAwNjQgMTkuNjg2M0M4NS43MDQ3IDIwLjQxNDcgODUuMjYyNSAyMS4wNzY1IDg0LjcwNSAyMS42MzRDODQuMTQ3NSAyMi4xOTE1IDgzLjQ4NTcgMjIuNjMzNyA4Mi43NTczIDIyLjkzNTRDODIuMDI4OSAyMy4yMzcxIDgxLjI0ODIgMjMuMzkyNCA4MC40NTk4IDIzLjM5MjRDNzkuNjcxNCAyMy4zOTI0IDc4Ljg5MDcgMjMuMjM3MSA3OC4xNjIzIDIyLjkzNTRDNzcuNDMzOSAyMi42MzM3IDc2Ljc3MjEgMjIuMTkxNSA3Ni4yMTQ2IDIxLjYzNEM3NS42NTcxIDIxLjA3NjUgNzUuMjE0OSAyMC40MTQ3IDc0LjkxMzIgMTkuNjg2M0M3NC42MTE1IDE4Ljk1NzkgNzQuNDU2MiAxOC4xNzcyIDc0LjQ1NjIgMTcuMzg4OFYxNy4zODg4Wk04My43MzAyIDE3LjM4ODhDODMuNzMwMiAxNC45MTAxIDgyLjQ1NzkgMTMuNDMwNCA4MC40NTk4IDEzLjQzMDRDNzguNDYxNyAxMy40MzA0IDc3LjE5ODggMTQuOTEwMSA3Ny4xOTg4IDE3LjM4ODhDNzcuMTk4OCAxOS44Njc1IDc4LjQ3MTIgMjEuNDIyNiA4MC40NTk4IDIxLjQyMjZDODIuNDQ4NCAyMS40MjI2IDgzLjczOTYgMTkuODQ4NyA4My43Mzk2IDE3LjM4ODhIODMuNzMwMloiIGZpbGw9IiMxMDEwMTAiLz4KPHBhdGggZD0iTTEwMC4wOTIgMjEuNDY5OEwxMDIuNDM4IDIwLjUyNzNDMTAzLjI4MSAyMS4xMzQ3IDEwNC4yOTMgMjEuNDY0MiAxMDUuMzMyIDIxLjQ2OThDMTA2LjcwOCAyMS40Njk4IDEwNy40MzQgMjAuOTcwMiAxMDcuNDM0IDIwLjE2OTFDMTA3LjQzNCAxOS4zNjggMTA2LjYzMyAxOS4wNjY0IDEwNS40NTQgMTguNjQyM0wxMDMuNjczIDE3Ljk5MkMxMDIuMzQ0IDE3LjUxMTMgMTAxLjAwNiAxNi41OTcxIDEwMS4wMDYgMTQuOTQ3OEMxMDEuMDA2IDEzLjA2MjggMTAyLjg5MSAxMS42Nzc0IDEwNS41NjggMTEuNjc3NEMxMDcuNDA2IDExLjY5NjMgMTA5LjE2OCAxMi40MTQgMTEwLjQ5NyAxMy42ODQ5TDEwOC4zNTcgMTQuNTUxOUMxMDcuNTQ3IDEzLjkzMDEgMTA2LjU1MSAxMy41OTgyIDEwNS41MyAxMy42MDk1QzEwNC4zNzEgMTMuNjA5NSAxMDMuNjQ1IDE0LjA1MjQgMTAzLjY0NSAxNC43OTdDMTAzLjY0NSAxNS41NDE1IDEwNC41ODcgMTUuODk5NyAxMDUuNzA5IDE2LjI4NjFMMTA3LjQ0MyAxNi45NjQ3QzEwOS4wNDUgMTcuNTMwMiAxMTAuMDkxIDE4LjQwNjcgMTEwLjA5MSAyMC4wMzcyQzExMC4wOTEgMjEuOTIyMiAxMDguMzAxIDIzLjQ2NzggMTA1LjI1NiAyMy40Njc4QzEwMy4zNjMgMjMuMzgzNiAxMDEuNTQ5IDIyLjY4MTggMTAwLjA5MiAyMS40Njk4VjIxLjQ2OThaIiBmaWxsPSIjMTAxMDEwIi8+CjxwYXRoIGQ9Ik05NS44Nzg4IDExLjY3NzNWMTYuMzMzMVYxOS4xNjA2TDkwLjY5NTIgMTEuNjIwN0g4OC4xNTA1VjIzLjM2NDFIOTAuNjk1MlYxNS44MjQyTDk1Ljg3ODggMjMuMzY0MUg5OC40MTQxVjExLjY2NzlMOTUuODc4OCAxMS42NzczWiIgZmlsbD0iIzEwMTAxMCIvPgo8cGF0aCBkPSJNMTQzLjQ1NSAxMS42NzczVjE2LjMzMzFWMTkuMTYwNkwxMzguMjcyIDExLjYyMDdIMTM1LjcxOFYyMy4zNjQxSDEzOC4yNTNWMTUuODI0MkwxNDMuNDM2IDIzLjM2NDFIMTQ1Ljk4MVYxMS42Njc5TDE0My40NTUgMTEuNjc3M1oiIGZpbGw9IiMxMDEwMTAiLz4KPHBhdGggZD0iTTExOC4wMDggMjEuNDY5OEMxMTYuMDQ4IDIxLjQ2OTggMTE0Ljc5NCAxOS45MjQxIDExNC43OTQgMTcuNTAxOUMxMTQuNzk0IDE1LjA3OTcgMTE2LjA0OCAxMy42MDk1IDExOC4wMDggMTMuNjA5NUMxMTguNTE1IDEzLjU5MDkgMTE5LjAxOCAxMy43MDQ2IDExOS40NjcgMTMuOTM5MkMxMTkuOTE3IDE0LjE3MzkgMTIwLjI5NyAxNC41MjE1IDEyMC41NzIgMTQuOTQ3OEwxMjIuOTM3IDE0LjAwNTNDMTIyLjM4IDEzLjIzMTYgMTIxLjYzNSAxMi42MTE2IDEyMC43NzMgMTIuMjAyOUMxMTkuOTEyIDExLjc5NDMgMTE4Ljk2IDExLjYxMDIgMTE4LjAwOCAxMS42NjhDMTE0LjUxMiAxMS42NjggMTEyLjA5OSAxMy44MTY4IDExMi4wOTkgMTcuNTExM0MxMTIuMDQzIDE4LjMwMjYgMTEyLjE1OCAxOS4wOTY1IDExMi40MzUgMTkuODM5N0MxMTIuNzEyIDIwLjU4MjkgMTEzLjE0NSAyMS4yNTgxIDExMy43MDUgMjEuODE5OUMxMTQuMjY1IDIyLjM4MTYgMTE0LjkzOSAyMi44MTY4IDExNS42ODEgMjMuMDk2MkMxMTYuNDIzIDIzLjM3NTYgMTE3LjIxNyAyMy40OTI3IDExOC4wMDggMjMuNDM5NkMxMTguODg1IDIzLjQ3OTggMTE5Ljc2IDIzLjMxOSAxMjAuNTY1IDIyLjk2OTRDMTIxLjM3IDIyLjYxOTkgMTIyLjA4NSAyMi4wOTA4IDEyMi42NTUgMjEuNDIyN0wxMjAuMjg5IDIwLjQ4MDJDMTIwLjAwNSAyMC44MDIyIDExOS42NTMgMjEuMDU3OCAxMTkuMjU5IDIxLjIyODhDMTE4Ljg2NSAyMS4zOTk4IDExOC40MzggMjEuNDgyMSAxMTguMDA4IDIxLjQ2OThWMjEuNDY5OFoiIGZpbGw9IiMxMDEwMTAiLz4KPHBhdGggZD0iTTEzMy45OTMgMjMuMTk0NUwxMzAuMzE3IDExLjc5MDVWMTEuNjc3NEgxMjcuMzk1VjExLjc5MDVMMTIzLjc0OCAyMy4xOTQ1TDEyMy42ODIgMjMuNDExM0gxMjYuMjkzVjIzLjI4ODhMMTI3LjA1NiAyMC40NjEzSDEzMC41MTVMMTMxLjI4OCAyMy4yODg4VjIzLjQxMTNIMTM0LjAyMUwxMzMuOTkzIDIzLjE5NDVaTTEyOS45NCAxOC4zODc4SDEyNy42NUwxMjcuOTMzIDE3LjM0MTdDMTI4LjIzNCAxNi4yNjczIDEyOC41MzYgMTUuMTY0NiAxMjguNzkgMTQuMDkwMUwxMjkuMDQ1IDE1LjA4OTJDMTI5LjI0MyAxNS44NDMxIDEyOS40NDEgMTYuNjE2IDEyOS42NTcgMTcuMzQxN0wxMjkuOTQgMTguMzg3OFoiIGZpbGw9IiMxMDEwMTAiLz4KPC9nPgo8ZGVmcz4KPGNsaXBQYXRoIGlkPSJjbGlwMCI+CjxyZWN0IHdpZHRoPSIxNDYiIGhlaWdodD0iMzUuMDUwOSIgZmlsbD0id2hpdGUiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4=";
        tronscanIcon.alt = "Tronscan";
        tronscanIcon.style.width = "64px";
        tronscanIcon.style.height = "64px";
        tronscanIcon.style.verticalAlign = "middle";
        tronscanIconLink.appendChild(tronscanIcon);
        peerAddressCell.appendChild(tronscanIconLink);
    });

    // 更新结果数量
    const t = translations[currentLanguage];
    document.getElementById("resultCount").textContent = currentLanguage === "zh-TW" ?
        `顯示 ${transactions.length} 筆交易` :
        `Showing ${transactions.length} transactions`;

    // 更新總收款量和總付款量
    document.getElementById("totalReceived").textContent = window.filteredTotalReceived.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
    document.getElementById("totalSent").textContent = window.filteredTotalSent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

function sortTransactions(field) {
    if (sortField === field) {
        sortOrder = sortOrder === "asc" ? "desc" : "asc";
    } else {
        sortField = field;
        sortOrder = "desc";
    }
    sortAndFilterTransactions();
    updateSortIcons();
}

async function fetchBalance(address) {
    const apiUrl = `https://api.trongrid.io/v1/accounts/${address}`;
    const response = await fetchWithRetry(apiUrl);
    if (!response.ok) {
        console.log("獲取餘額失敗，status:", response.status);
        return { usdt: 0, trx: 0 };
    }
    const data = await response.json();

    // 獲取TRX餘額
    let trx_balance = 0;
    if (data.data[0] && data.data[0].balance) {
        trx_balance = data.data[0].balance / 1e6; // TRX餘額單位轉換
    }

    // 獲取USDT餘額
    const token_balances = data.data[0]['trc20'];
    const contractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // USDT 合约地址
    let usdt_balance = 0;
    for (const token of token_balances) {
        if (contractAddress in token) {
            usdt_balance = token[contractAddress];
        }
    }
    usdt_balance = usdt_balance / 1e6;

    console.log(`錢包餘額: ${usdt_balance} USDT, ${trx_balance} TRX`);
    return { usdt: usdt_balance, trx: trx_balance };
}

/**
 * 獲取帳戶能量值
 * @param {string} address - 錢包地址
 * @returns {Promise<Object>} - 包含可用能量和總能量的物件
 */
async function fetchEnergy(address) {
    try {
        // 使用正確的 API 端點獲取能量資訊
        const apiUrl = 'https://api.trongrid.io/wallet/getaccountresource';
        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: address,
                visible: true
            })
        });

        if (!response.ok) {
            console.log("獲取能量失敗，status:", response.status);
            return {
                available: 0,
                total: 0
            };
        }

        const data = await response.json();

        // 直接使用 API 回應中的 EnergyLimit 和 EnergyUsed 欄位
        const energyLimit = Math.floor(data.EnergyLimit || 0);
        const energyUsed = Math.floor(data.EnergyUsed || 0);
        const energyAvailable = Math.floor(energyLimit - energyUsed);

        console.log(`能量資訊: 總能量限制 ${energyLimit}, 已使用 ${energyUsed}, 可用 ${energyAvailable}`);

        // 返回包含可用能量和總能量的物件
        return {
            available: energyAvailable,
            total: energyLimit
        };
    } catch (error) {
        console.error('獲取能量時出錯:', error);
        return {
            available: 0,
            total: 0
        };
    }
}

async function fetchAndDisplayTransactions(address) {
    const contractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // USDT 合约地址
    const apiUrl = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`;
    let seenTransactionIds = new Set();

    // 顯示載入中的訊息
    updateLoadingStatusMessage("loading");

    let shouldContinue = true;
    while (shouldContinue && !isPaused) {
        const url = new URL(apiUrl);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const urlstring = url.toString();
        const paramsstring = urlstring.substring(urlstring.indexOf("?"));
        console.log("Fetching transactions parameters:", paramsstring);

        let response;
        try {
            response = await fetchWithRetry(url);
        } catch (error) {
            console.log("API 請求失敗，重試次數已用完:", error);
            console.log("目前已載入記錄數:", totalRecords);

            // API 錯誤時，設定為暫停狀態，讓用戶可以重試
            isPaused = true;
            const controlButton = document.getElementById("controlButton");
            controlButton.textContent = translations[currentLanguage].continue;
            controlButton.style.backgroundColor = "var(--primary)";
            controlButton.setAttribute("aria-busy", "false");

            updateStatusText("loading", totalRecords);
            updateLoadingStatusMessage("paused");
            console.log("已設定 isPaused = true，按鈕文字:", controlButton.textContent);
            break;
        }

        if (!response.ok) {
            console.log("API 請求失敗，response.status:", response.status);
            console.log("目前已載入記錄數:", totalRecords);

            // API 錯誤時，設定為暫停狀態，讓用戶可以重試
            isPaused = true;
            const controlButton = document.getElementById("controlButton");
            controlButton.textContent = translations[currentLanguage].continue;
            controlButton.style.backgroundColor = "var(--primary)";
            controlButton.setAttribute("aria-busy", "false");

            updateStatusText("loading", totalRecords);
            updateLoadingStatusMessage("paused");
            console.log("已設定 isPaused = true，按鈕文字:", controlButton.textContent);
            break;
        }

        const data = await response.json();
        const txs = data.data || [];

        const newTransactions = txs.filter(tx => {
            const value = parseFloat(tx.value) / Math.pow(10, tx.token_info.decimals);
            return tx.token_info?.address === contractAddress &&
                !seenTransactionIds.has(tx.transaction_id) &&
                tx.type === "Transfer"; // 只處理 Transfer 類型的交易
        }).map(tx => {
            const value = parseFloat(tx.value) / Math.pow(10, tx.token_info.decimals);
            const peerAddress = tx.to === address ? tx.from : tx.to;
            const action = tx.to === address ? "received" : "sent";
            seenTransactionIds.add(tx.transaction_id);

            return {
                transactionId: tx.transaction_id,
                value,
                timestamp: tx.block_timestamp,
                action,
                peerAddress,
            };
        });

        allTransactions = [...allTransactions, ...newTransactions];
        totalRecords += newTransactions.length;

        updateStatusText("loading", totalRecords);
        sortAndFilterTransactions();

        if (txs.length < 200) {
            updateStatusText("complete", totalRecords);
            isLoadingComplete = true;

            // 禁用暂停按钮
            const controlButton = document.getElementById("controlButton");
            controlButton.textContent = translations[currentLanguage].loadComplete;
            controlButton.disabled = true;
            controlButton.classList.add("disabled-button");
            controlButton.setAttribute("aria-busy", "false");

            // 顯示載入完成訊息
            updateLoadingStatusMessage("completed");

            shouldContinue = false; // 结束循环
        } else if (totalRecords >= maxRecords && !reachedMaxRecords && !ignoreMaxRecords) {
            // 达到最大记录数，但可以继续加载
            console.log("達到最大記錄數限制，停止載入。totalRecords:", totalRecords);
            updateStatusText("loadingLimit", totalRecords);
            reachedMaxRecords = true;
            isPaused = true;
            console.log("設定 isPaused = true");

            const controlButton = document.getElementById("controlButton");
            controlButton.textContent = translations[currentLanguage].continue;
            controlButton.style.backgroundColor = "var(--primary)";
            controlButton.setAttribute("aria-busy", "false");
            console.log("按鈕文字已更新為:", controlButton.textContent);

            // 顯示達到上限訊息
            updateLoadingStatusMessage("limitReached", totalRecords);

            shouldContinue = false; // 结束循环
        }

        params.max_timestamp = txs[txs.length - 1].block_timestamp - 1;
    }
}

function togglePause() {
    // 如果已经完成加载，则不执行任何操作
    if (isLoadingComplete) return;

    const controlButton = document.getElementById("controlButton");
    isPaused = !isPaused;

    console.log("isPaused:", isPaused);
    if (isPaused) {
        controlButton.textContent = translations[currentLanguage].continue;
        controlButton.style.backgroundColor = "var(--primary)";
        controlButton.setAttribute("aria-busy", "false");

        // 顯示暫停訊息
        updateLoadingStatusMessage("paused");
    } else {
        controlButton.textContent = translations[currentLanguage].pause;

        // 如果达到最大记录数后继续加载，重置标志并忽略最大记录数限制
        if (reachedMaxRecords) {
            reachedMaxRecords = false;
            ignoreMaxRecords = true; // 设置忽略最大记录数限制
            updateStatusText("loadingContinue", totalRecords);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const address = urlParams.get("address");
        if (address) {
            fetchAndDisplayTransactions(address); // 重新启动数据加载（會自動顯示載入中訊息）
        }
    }
}

function clearFilters() {
    document.getElementById("minAmount").value = "1.0";
    document.getElementById("maxAmount").value = "";
    document.getElementById("peerAddressFilter").value = "";
    document.getElementById("peerAddressFilterType").value = "include";
    document.getElementById("actionFilter").value = "both";

    // 重置時間過濾器
    setDefaultTimeFilters();

    sortAndFilterTransactions();
}

// 複製到劉貼板並顯示提示訊息的函數
function copyToClipboard(text, element, evt) {
    // 如果是金額數字，去除可能的千分位逗號
    if (!text.includes('/') && !text.includes(':')) {
        text = text.replace(/,/g, '');
    }

    // 移除單位 (如 USDT)
    if (text.includes('USDT')) {
        text = text.replace(' USDT', '');
    }

    navigator.clipboard.writeText(text).then(() => {
        // 創建提示訊息元素
        const tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = translations[currentLanguage].copySuccess;
        document.body.appendChild(tooltip);

        // 計算位置 (滑鼠位置或元素位置)
        let posX = 0;
        let posY = 0;

        if (evt && evt.clientX) {
            // 如果有事件對象，使用滑鼠位置
            posX = evt.clientX;
            posY = evt.clientY - 30;
        } else if (element) {
            // 如果有元素對象，使用元素位置
            const rect = element.getBoundingClientRect();
            posX = rect.left + rect.width / 2;
            posY = rect.top - 30;
        } else {
            // 如果都沒有，使用畫面中心
            posX = window.innerWidth / 2;
            posY = window.innerHeight / 2;
        }

        tooltip.style.left = `${posX}px`;
        tooltip.style.top = `${posY}px`;

        // 顯示提示訊息
        setTimeout(() => tooltip.classList.add('show'), 10);

        // 2秒後隱藏並移除提示訊息
        setTimeout(() => {
            tooltip.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(tooltip);
            }, 300);
        }, 2000);
    });
}

// 獲取複製圖標的 SVG 代碼
function getCopyIconSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M19.5 16.5L19.5 4.5L18.75 3.75H9L8.25 4.5L8.25 7.5L5.25 7.5L4.5 8.25V20.25L5.25 21H15L15.75 20.25V17.25H18.75L19.5 16.5ZM15.75 15.75L15.75 8.25L15 7.5L9.75 7.5V5.25L18 5.25V15.75H15.75ZM6 9L14.25 9L14.25 19.5L6 19.5L6 9Z"/>
    </svg>`;
}

// 格式化日期為標準格式
window.onload = () => {
    // 首先检测语言并应用翻译
    detectLanguage();

    // 初始化時間標頭為本地時間
    updateTimeHeader();

    // 不再需要初始化金額複製圖標，因為已移除

    loadURLParams(); // 加载 URL 参数

    const urlParams = new URLSearchParams(window.location.search);
    const address = urlParams.get("address");

    if (address) {
        document.getElementById("walletAddress").textContent = address;
        document.getElementById("addressInput").value = address;
        document.getElementById('usdtBalance').textContent = "0";
        document.getElementById('trxBalance').textContent = "0";
        document.getElementById('energyBalance').innerHTML = "0 / <span style=\"color: var(--sent-color);\">0</span>";

        fetchBalance(address).then(balance => {
            const formattedUsdt = balance.usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedTrx = balance.trx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            document.getElementById('usdtBalance').textContent = formattedUsdt;
            document.getElementById('trxBalance').textContent = formattedTrx;

            // 更新錢包餘額標籤，包含地址
            updateWalletBalanceLabel(address);
        }).catch(error => {
            console.error("Failed to fetch balance:", error);
            document.getElementById('usdtBalance').textContent = "N/A";
            document.getElementById('trxBalance').textContent = "N/A";
        });

        fetchEnergy(address).then(energy => {
            // 格式化為「可用量/總量」的形式，並確保數字精確到整數
            const availableEnergy = Math.floor(energy.available);
            const totalEnergy = Math.floor(energy.total);

            // 使用 toLocaleString 使數字每三位有一個逗號分隔
            const formattedAvailable = availableEnergy.toLocaleString('en-US');
            const formattedTotal = totalEnergy.toLocaleString('en-US');
            // 使用 HTML 標籤將總能量數值設為紅色
            const energyDisplay = `${formattedAvailable} / <span style="color: var(--sent-color);">${formattedTotal}</span>`;

            document.getElementById('energyBalance').innerHTML = energyDisplay;
        }).catch(error => {
            console.error("Failed to fetch energy:", error);
            document.getElementById('energyBalance').innerHTML = "0 / <span style=\"color: var(--sent-color);\">0</span>";
        });

        fetchAndDisplayTransactions(address); // 开始加载数据
    }

    // 設置查詢按鈕的點擊事件
    document.getElementById("queryButton").onclick = function () {
        // 在提交表單前，將當前語系設定到隱藏的語言輸入欄位
        document.getElementById("langInput").value = currentLanguage;
        // 提交表單
        document.getElementById("queryForm").submit();
    };

    document.getElementById("controlButton").onclick = togglePause;
    document.getElementById("clearFiltersButton").onclick = clearFilters;
    document.getElementById("languageToggle").onclick = toggleLanguage; // 添加語言切換按鈕的點擊事件

    // 绑定筛选条件实时更新事件
    document.getElementById("minAmount").addEventListener("input", sortAndFilterTransactions);
    document.getElementById("maxAmount").addEventListener("input", sortAndFilterTransactions);
    document.getElementById("peerAddressFilter").addEventListener("input", sortAndFilterTransactions);
    document.getElementById("peerAddressFilterType").addEventListener("change", sortAndFilterTransactions);
    document.getElementById("actionFilter").addEventListener("change", sortAndFilterTransactions);

    // 绑定時間過濾器的事件監聽器
    document.getElementById("startDate").addEventListener("change", sortAndFilterTransactions);
    document.getElementById("startTime").addEventListener("change", sortAndFilterTransactions);
    document.getElementById("endDate").addEventListener("change", sortAndFilterTransactions);
    document.getElementById("endTime").addEventListener("change", sortAndFilterTransactions);

    // 時間切換按鈕事件
    document.getElementById("startTimeToggle").onclick = function () { toggleTimeInput("start"); };
    document.getElementById("endTimeToggle").onclick = function () { toggleTimeInput("end"); };

    // 快速選擇按鈕事件
    document.getElementById("btnToday").onclick = function () { setQuickTimeRange(0); };
    document.getElementById("btn3Days").onclick = function () { setQuickTimeRange(2); };
    document.getElementById("btnWeek").onclick = function () { setQuickTimeRange(6); };

    // 更新排序图示
    updateSortIcons();
};

// 切换语言
function toggleLanguage() {
    currentLanguage = currentLanguage === "zh-TW" ? "en" : "zh-TW";

    // 更新 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("lang", currentLanguage);
    history.replaceState(null, "", "?" + urlParams.toString());

    // 应用翻译
    applyTranslations();

    // 更新控制按鈕的文字
    const controlButton = document.getElementById("controlButton");
    if (!controlButton.disabled) {
        if (isPaused) {
            controlButton.textContent = translations[currentLanguage].continue;
        } else {
            controlButton.textContent = translations[currentLanguage].pause;
        }
    } else {
        controlButton.textContent = translations[currentLanguage].loadComplete;
    }

    // 更新所有圖標的提示文字
    document.querySelectorAll('.copy-icon').forEach(icon => {
        icon.title = translations[currentLanguage].copyTooltip;
    });
    document.querySelectorAll('.tronscan-icon').forEach(icon => {
        icon.title = translations[currentLanguage].tronscanTooltip;
    });

    // 更新載入狀態訊息
    if (isLoadingComplete) {
        updateLoadingStatusMessage("completed");
    } else if (reachedMaxRecords && isPaused) {
        updateLoadingStatusMessage("limitReached", totalRecords);
    } else if (isPaused) {
        updateLoadingStatusMessage("paused");
    } else if (totalRecords > 0) {
        updateLoadingStatusMessage("loading");
    }

    // 更新時間標頭
    updateTimeHeader();

    // 更新所有時間单元格
    document.querySelectorAll('.timestamp-cell').forEach(cell => {
        updateTimestampDisplay(cell, parseInt(cell.dataset.timestamp));
    });

    // 如果已有交易数据，重新显示
    if (allTransactions.length > 0 && timeDisplayMode !== "age") {
        sortAndFilterTransactions();
    }
}

// 切換時間顯示模式
function toggleTimeDisplayMode() {
    // 循環切換模式: local -> utc -> age -> local
    if (timeDisplayMode === "local") {
        timeDisplayMode = "utc";
    } else if (timeDisplayMode === "utc") {
        timeDisplayMode = "age";
        // 啟動定期更新經過時間
        startAgeUpdates();
    } else {
        timeDisplayMode = "local";
        // 停止定期更新
        stopAgeUpdates();
    }

    // 更新時間標頭
    updateTimeHeader();

    // 更新所有時間单元格
    document.querySelectorAll('.timestamp-cell').forEach(cell => {
        updateTimestampDisplay(cell, parseInt(cell.dataset.timestamp));
    });
}

// 更新時間標頭文字
function updateTimeHeader() {
    const timeHeader = document.getElementById("timeHeader");
    if (!timeHeader) return;

    const timeDisplayElement = timeHeader.querySelector('.time-display');
    if (!timeDisplayElement) return;

    let headerText = "";
    if (timeDisplayMode === "local") {
        const offset = new Date().getTimezoneOffset() * -1;
        const sign = offset >= 0 ? "+" : "-";
        const hours = Math.floor(Math.abs(offset) / 60);
        const minutes = Math.abs(offset) % 60;
        const offsetStr = `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        headerText = `${translations[currentLanguage].timeLocal} ${toggleIconSvg}<br><small>(${offsetStr})</small>`;
    } else if (timeDisplayMode === "utc") {
        headerText = `${translations[currentLanguage].timeUTC} ${toggleIconSvg}`;
    } else {
        headerText = `${translations[currentLanguage].timeAge} ${toggleIconSvg}`;
    }

    // 更新時間顯示元素的內容
    timeDisplayElement.innerHTML = headerText;

    // 添加滑鼠懸停提示文字
    timeHeader.title = translations[currentLanguage].timeToggleHint;
}

// 更新時間顯示
function updateTimestampDisplay(cell, timestamp) {
    if (!cell) return;

    if (timeDisplayMode === "local") {
        // 本地時間模式
        cell.textContent = new Date(timestamp).toLocaleString(currentLanguage === "zh-TW" ? 'zh-TW' : 'en-US', {
            hour12: false
        });
    } else if (timeDisplayMode === "utc") {
        // UTC 時間
        cell.textContent = new Date(timestamp).toLocaleString(currentLanguage === "zh-TW" ? 'zh-TW' : 'en-US', {
            timeZone: 'UTC',
            hour12: false
        }) + " UTC";
    } else {
        // 經過時間 (age)
        cell.textContent = getTimeDifference(timestamp);
    }
}

// 計算時間差異
function getTimeDifference(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); // 差異秒數

    const days = Math.floor(diff / 86400); // 86400 = 24 * 60 * 60
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    let result = "";
    const t = translations[currentLanguage];

    if (days > 0) {
        // 如果有天數，顯示天和小時
        result = formatString(t.ageDay, days, hours);
    } else if (hours > 0) {
        // 如果有小時，顯示小時和分鐘
        result = formatString(t.ageHour, hours, minutes);
    } else if (minutes > 0) {
        // 如果有分鐘，顯示分鐘和秒
        result = formatString(t.ageMinute, minutes, seconds);
    } else {
        // 只有秒
        result = formatString(t.ageSecond, seconds);
    }

    return result + t.ageSuffix;
}

// 啟動定期更新經過時間
function startAgeUpdates() {
    // 停止現有的計時器
    stopAgeUpdates();

    // 每秒更新一次
    ageUpdateInterval = setInterval(() => {
        document.querySelectorAll('.timestamp-cell').forEach(cell => {
            const timestamp = parseInt(cell.dataset.timestamp);
            cell.textContent = getTimeDifference(timestamp);
        });
    }, 1000);
}

// 停止定期更新
function stopAgeUpdates() {
    if (ageUpdateInterval) {
        clearInterval(ageUpdateInterval);
        ageUpdateInterval = null;
    }
}

// 更新錢包餘額標籤，包含地址
function updateWalletBalanceLabel(address) {
    const t = translations[currentLanguage];
    if (address) {
        // 使用 formatString 函數將地址插入到翻譯字串中
        document.getElementById("walletBalanceLabel").textContent = formatString(t.walletBalanceLabel, address);

        // 更新 Tronscan 圖標連結
        const tronscanIcon = document.getElementById("tronscanIcon");
        tronscanIcon.href = `https://tronscan.org/#/address/${address}`;
        tronscanIcon.title = translations[currentLanguage].tronscanTooltip;
        tronscanIcon.style.display = "inline-block";
    } else {
        // 如果沒有地址，只顯示基本標籤
        document.getElementById("walletBalanceLabel").textContent = t.walletBalanceLabel.replace(/ \(.*\)/, "");
        document.getElementById("tronscanIcon").style.display = "none";
    }
}
