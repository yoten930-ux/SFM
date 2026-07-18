import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 修改這兩行，確保它是純 JavaScript 寫法
const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
