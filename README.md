# TRC20 USDT  Transaction Record Viewer

This is a lightweight web application for querying and displaying TRC20 USDT transaction records of a specific address on the TRON blockchain.
中文版說明在下方。

## Features

- Query transaction records of any TRON wallet address
- Supports sorting by time, transaction type, and amount
- Provides multiple filtering conditions:
  - Minimum/maximum amount
  - Peer address keyword
  - Transaction type (received/sent)
- Filtering conditions are automatically appended to the URL, making it easy to share
- Automatically loads historical transaction data, with a default limit of 10,000 records, and can be set to load more records without limit
- Transaction ID and address can be linked directly to Tronscan blockchain explorer

## Usage

1. Open `trc20usdtviewer.html` in a browser
2. Enter the TRON wallet address to query in the address input box
3. Click the "Query" button to start loading transaction records
4. Use the filtering conditions to narrow down the search scope:
   - Set minimum/maximum amount
   - Enter peer address keyword
   - Select transaction type (received/sent/all)
5. Click on the table header to sort by the corresponding column
6. Click on the transaction ID or address to view details on Tronscan

## Notes

- Due to API limitations, each query returns up to 200 transactions, and the system will automatically paginate to load more data
- To avoid excessive resource usage, the system is set to display 10,000 records by default, and will pause loading when reaching the limit
- Users can choose to click the "Continue Loading" button to retrieve more records, and once chosen, there will be no limit on the number of records
- Querying large numbers of transactions may take a longer time, and the "Pause" button can be used to control the loading process

## Customization

You can save and share the query conditions through URL parameters:
- `address`: The TRON wallet address to query
- `min`: Minimum amount
- `max`: Maximum amount
- `peer`: Peer address keyword
- `action`: Transaction type (both/received/sent)
- `sortField`: Sorting column
- `sortOrder`: Sorting direction (asc/desc)

For example: `trc20usdtviewer.html?address=TRx...&min=100&action=received&sortField=value&sortOrder=desc`

## License

This tool is for learning and personal use only, and please comply with the terms of use and limitations of the TronGrid API when using it.

# TRC20 USDT 交易紀錄查詢工具

這是一個輕量級的網頁應用程式，用於查詢和顯示 TRON 區塊鏈上特定地址的 TRC20 USDT 交易紀錄。

## 功能特點

- 查詢任意 TRON 錢包地址的 USDT 交易紀錄
- 支援按時間、交易類型和金額排序
- 提供多種篩選條件：
  - 最小/最大金額
  - 對方地址關鍵字
  - 交易類型（收款/付款）
- 篩選條件會自動附加在網址列，方便分享
- 自動載入歷史交易資料，預設顯示 10,000 筆記錄，達到上限後可選擇繼續載入而無上限
- 交易 ID 和地址可直接連結到 Tronscan 區塊鏈瀏覽器

## 使用方法

1. 在瀏覽器中打開 `trc20usdtviewer.html`
2. 在錢包地址輸入框中輸入要查詢的 TRON 地址
3. 點擊「查詢」按鈕開始載入交易紀錄
4. 使用篩選條件縮小查詢範圍：
   - 設定最小/最大金額
   - 輸入對方地址關鍵字
   - 選擇交易類型（收款/付款/全部）
5. 點擊表格標題可以按照對應欄位排序
6. 點擊交易 ID 或地址可在 Tronscan 查看詳細資訊

## 注意事項

- 由於 API 限制，每次查詢最多返回 200 筆交易，系統會自動分頁載入更多資料
- 為避免過度佔用資源，系統預設顯示 10,000 筆記錄，達到上限後會暫停載入
- 用戶可以選擇點擊「繼續載入」按鈕獲取更多記錄，一旦選擇繼續載入，將不再有記錄數量限制
- 查詢大量交易時可能需要較長時間，可使用暫停按鈕控制載入過程

## 自訂設定

可以通過 URL 參數保存和分享查詢條件：
- `address`: 要查詢的錢包地址
- `min`: 最小金額
- `max`: 最大金額
- `peer`: 對方地址關鍵字
- `action`: 交易類型（both/received/sent）
- `sortField`: 排序欄位
- `sortOrder`: 排序方向（asc/desc）

例如：`trc20usdtviewer.html?address=TRx...&min=100&action=received&sortField=value&sortOrder=desc`

## 授權

本工具僅供學習和個人使用，使用 TronGrid API 時請遵守其使用條款和限制。
