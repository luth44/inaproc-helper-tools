// ==========================================
// 1. LOGIKA KALKULATOR EXCLUDE PPN (EXISTING)
// ==========================================
const includeInput = document.getElementById('includeInput');
const excludeInput = document.getElementById('excludeInput');
const copyBtn = document.getElementById('copyBtn');
const copyIcon = document.getElementById('copyIcon');
const copyStatus = document.getElementById('copyStatus');

let rawExcludeValue = "";

function customRound(num) {
  const integerPart = Math.floor(num);
  const decimalPart = num - integerPart;
  if (decimalPart > 0.5 + 1e-9) {
    return integerPart + 1;
  }
  return integerPart;
}

function formatRibuan(angkaString) {
  if (!angkaString) return "";
  return String(angkaString).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatRupiahDec(num) {
  if (!num || isNaN(num)) return "Rp0,00";
  return `Rp${formatRibuan(String(Math.round(num)))},00`;
}

includeInput.addEventListener('input', (e) => {
  const cleanDigits = e.target.value.replace(/\D/g, '');
  if (!cleanDigits) {
    includeInput.value = "";
    excludeInput.value = "";
    rawExcludeValue = "";
    return;
  }
  includeInput.value = formatRibuan(cleanDigits);

  const includeNumber = parseInt(cleanDigits, 10);
  const divided = includeNumber / 1.11;
  const finalExclude = customRound(divided);

  rawExcludeValue = finalExclude.toString();
  excludeInput.value = formatRibuan(rawExcludeValue);
});

copyBtn.addEventListener('click', async () => {
  if (!rawExcludeValue) return;
  try {
    await navigator.clipboard.writeText(rawExcludeValue);
    copyBtn.classList.add('copied');
    copyIcon.innerHTML = `<polyline points="20 6 9 17 4 12"></polyline>`;
    copyStatus.className = "status-text text-success";
    copyStatus.textContent = `Tersalin: ${rawExcludeValue}`;

    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyIcon.innerHTML = `
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      `;
      copyStatus.textContent = "";
    }, 1500);
  } catch (err) {
    copyStatus.className = "status-text text-error";
    copyStatus.textContent = "Gagal menyalin ke clipboard";
  }
});

// ==========================================
// HELPER ALERT UMUM
// ==========================================
function renderAlert(el, ok, msg) {
  if (!msg) {
    el.className = 'alert-box';
    return;
  }
  el.textContent = msg;
  el.className = ok ? 'alert-box ok' : 'alert-box err';
}

// ==========================================
// 2. LOGIKA INAPROC REFERENCE GRABBER + AUTO-SAVE + VERTICAL RESIZE
// ==========================================
const scanRefBtn = document.getElementById('scanRefBtn');
const refResultBox = document.getElementById('refResultBox');
const refNameText = document.getElementById('refNameText');
const refTypeBadge = document.getElementById('refTypeBadge');
const refOriginBadge = document.getElementById('refOriginBadge');
const refImgCountBadge = document.getElementById('refImgCountBadge');
const refThumbsRow = document.getElementById('refThumbsRow');
const refMetaText = document.getElementById('refMetaText');
const scanMatchFormBtn = document.getElementById('scanMatchFormBtn');
const matchPreviewBox = document.getElementById('matchPreviewBox');
const matchSummaryText = document.getElementById('matchSummaryText');
const toggleMatchExpandBtn = document.getElementById('toggleMatchExpandBtn');
const matchList = document.getElementById('matchList');
const matchDragHandle = document.getElementById('matchDragHandle');
const variantEditorSection = document.getElementById('variantEditorSection');
const toggleVariantExpandBtn = document.getElementById('toggleVariantExpandBtn');
const globalTaxSwitchBtn = document.getElementById('globalTaxSwitchBtn');
const variantCountBadge = document.getElementById('variantCountBadge');
const variantColHeader = document.getElementById('variantColHeader');
const disableAllStatusBtn = document.getElementById('disableAllStatusBtn');
const variantTableWrap = document.getElementById('variantTableWrap');
const variantDragHandle = document.getElementById('variantDragHandle');
const variantEditorBody = document.getElementById('variantEditorBody');
const fillMinPriceAllBtn = document.getElementById('fillMinPriceAllBtn');
const fillMaxPriceAllBtn = document.getElementById('fillMaxPriceAllBtn');
const bulkStockInput = document.getElementById('bulkStockInput');
const bulkPriceInput = document.getElementById('bulkPriceInput');
const applyBulkVariantBtn = document.getElementById('applyBulkVariantBtn');
const autoUploadImgCheck = document.getElementById('autoUploadImgCheck');
const uploadImgLabel = document.getElementById('uploadImgLabel');
const confirmRefFillBtn = document.getElementById('confirmRefFillBtn');
const clearRefBtn = document.getElementById('clearRefBtn');
const refStatus = document.getElementById('refStatus');

const REF_STORAGE_KEY = 'inaprocRefStateV1';
const UI_LAYOUT_STORAGE_KEY = 'inaprocPanelLayoutV1';

let grabbedRefData = null;
let matchedTargets = [];
let matchedValuesMap = {};
let matchedPreviewItems = [];
let matchSummaryLabel = '';
let currentVariantHeaderName = 'Varian';
let scannedVariantRows = [];
let variantRowRefs = [];
let globalVariantTaxMode = 'exclude';

let panelLayoutState = {
  matchHeight: 150,
  matchExpanded: false,
  variantHeight: 235,
  variantExpanded: false
};

function applyPanelLayoutUI() {
  if (panelLayoutState.matchExpanded) {
    matchList.classList.add('is-expanded');
    toggleMatchExpandBtn.textContent = 'Ringkas';
    toggleMatchExpandBtn.classList.add('is-active');
  } else {
    matchList.classList.remove('is-expanded');
    matchList.style.height = `${panelLayoutState.matchHeight}px`;
    toggleMatchExpandBtn.textContent = 'Full';
    toggleMatchExpandBtn.classList.remove('is-active');
  }

  if (panelLayoutState.variantExpanded) {
    variantTableWrap.classList.add('is-expanded');
    toggleVariantExpandBtn.textContent = 'Ringkas';
    toggleVariantExpandBtn.classList.add('is-active');
  } else {
    variantTableWrap.classList.remove('is-expanded');
    variantTableWrap.style.height = `${panelLayoutState.variantHeight}px`;
    toggleVariantExpandBtn.textContent = 'Full';
    toggleVariantExpandBtn.classList.remove('is-active');
  }
}

function savePanelLayoutState() {
  chrome.storage.local.set({ [UI_LAYOUT_STORAGE_KEY]: panelLayoutState });
}

function attachVerticalResizer(handleEl, targetEl, minHeight, stateHeightKey, stateExpandKey) {
  handleEl.addEventListener('mousedown', (e) => {
    e.preventDefault();

    if (panelLayoutState[stateExpandKey]) {
      panelLayoutState[stateExpandKey] = false;
      applyPanelLayoutUI();
    }

    const startY = e.clientY;
    const startHeight = targetEl.getBoundingClientRect().height;
    handleEl.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';

    function onMouseMove(moveEvt) {
      const deltaY = moveEvt.clientY - startY;
      const newHeight = Math.max(minHeight, Math.min(900, Math.round(startHeight + deltaY)));
      panelLayoutState[stateHeightKey] = newHeight;
      targetEl.style.height = `${newHeight}px`;
    }

    function onMouseUp() {
      handleEl.classList.remove('dragging');
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      savePanelLayoutState();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

attachVerticalResizer(matchDragHandle, matchList, 70, 'matchHeight', 'matchExpanded');
attachVerticalResizer(variantDragHandle, variantTableWrap, 110, 'variantHeight', 'variantExpanded');

toggleMatchExpandBtn.addEventListener('click', () => {
  panelLayoutState.matchExpanded = !panelLayoutState.matchExpanded;
  applyPanelLayoutUI();
  savePanelLayoutState();
});

toggleVariantExpandBtn.addEventListener('click', () => {
  panelLayoutState.variantExpanded = !panelLayoutState.variantExpanded;
  applyPanelLayoutUI();
  savePanelLayoutState();
});

function saveRefStateToStorage() {
  if (!grabbedRefData) {
    chrome.storage.local.remove(REF_STORAGE_KEY);
    return;
  }

  const statePayload = {
    grabbedRefData,
    matchedTargets,
    matchedValuesMap,
    matchedPreviewItems,
    matchSummaryLabel,
    currentVariantHeaderName,
    scannedVariantRows,
    globalVariantTaxMode,
    autoUploadChecked: autoUploadImgCheck.checked
  };

  chrome.storage.local.set({ [REF_STORAGE_KEY]: statePayload });
}

function renderRefSummaryUI(refData) {
  const imgs = refData.imageUrls || [];

  refNameText.textContent = refData.productName;
  refTypeBadge.textContent = refData.productTypeLabel;
  refOriginBadge.textContent = refData.productOrigin === 'Import'
    ? `Import (${refData.countryOfOrigin || '-'})`
    : 'Lokal (PDN)';
  refImgCountBadge.textContent = `${imgs.length} Foto`;

  refThumbsRow.innerHTML = '';
  imgs.forEach((src) => {
    const img = document.createElement('img');
    img.className = 'ref-thumb';
    img.src = src;
    refThumbsRow.appendChild(img);
  });

  uploadImgLabel.textContent = `Auto-upload semua (${imgs.length}) foto produk ke form`;

  const specCount = Object.keys(refData.specs || {}).length;
  const hargaProdukStr = refData.includePrice > 0
    ? `Rp ${formatRibuan(String(refData.includePrice))}`
    : '-';
  const merekDisplay = refData.brandApplicationNumber
    ? `${refData.brandValue || '-'} (${refData.brandApplicationNumber})`
    : (refData.brandValue || '-');

  refMetaText.innerHTML = `
    Merek: <b>${merekDisplay}</b> |
    KBKI: <b>${refData.kbkiCode || '-'}</b> |
    Harga: <b>${hargaProdukStr}</b> |
    Detail: <b>${specCount} item</b>
  `;

  refResultBox.style.display = 'block';
}

function renderMatchedListUI(previewItems, summaryText) {
  matchList.innerHTML = '';
  previewItems.forEach((item) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'match-item';
    itemDiv.innerHTML = `<div class="match-key">${item.label}</div><div class="match-val">${item.displayVal}</div>`;
    matchList.appendChild(itemDiv);
  });

  if (summaryText) {
    matchSummaryText.textContent = summaryText;
    matchPreviewBox.style.display = 'block';
  }
}

function parsePriceHintRange(priceHintText) {
  if (!priceHintText) return { min: 0, max: 0 };
  const matches = priceHintText.match(/Rp\s*[\d.,]+/gi) || [];
  const parsedNums = matches.map((m) => {
    const beforeDec = m.split(',')[0];
    const digits = beforeDec.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }).filter((n) => n > 0);

  if (parsedNums.length >= 2) {
    return { min: parsedNums[0], max: parsedNums[1] };
  }
  return { min: 0, max: 0 };
}

function getVariantPriceError(item) {
  if (!item || !item.isActive) return '';

  const isIncMode = item.taxViewMode === 'include';
  const activeDigits = isIncMode ? item.includePrice : item.excludePrice;
  const excNum = item.excludePrice ? parseInt(item.excludePrice, 10) : 0;
  const activeNum = activeDigits ? parseInt(activeDigits, 10) : 0;

  if (excNum > 0 && item.maxExclude > 0 && excNum > item.maxExclude) {
    const maxLimitDisplay = isIncMode
      ? formatRupiahDec(Math.round(item.maxExclude * 1.11))
      : formatRupiahDec(item.maxExclude);
    return `Harga tidak boleh lebih dari (${maxLimitDisplay})`;
  }

  if (activeNum > 0 && item.minExclude > 0 && excNum < item.minExclude) {
    const minLimitDisplay = isIncMode
      ? formatRupiahDec(Math.round(item.minExclude * 1.11))
      : formatRupiahDec(item.minExclude);
    return `Harga tidak boleh kurang dari (${minLimitDisplay})`;
  }

  return '';
}

function syncGlobalTaxButtonUI() {
  if (scannedVariantRows.length > 0) {
    const allInc = scannedVariantRows.every((r) => r.taxViewMode === 'include');
    const allExc = scannedVariantRows.every((r) => r.taxViewMode === 'exclude');
    if (allInc) globalVariantTaxMode = 'include';
    else if (allExc) globalVariantTaxMode = 'exclude';
  }

  if (globalVariantTaxMode === 'include') {
    globalTaxSwitchBtn.textContent = 'All: Inc';
    globalTaxSwitchBtn.classList.add('mode-include');
    globalTaxSwitchBtn.title = 'Semua varian dalam mode Include PPN 12%. Klik untuk ubah semua ke Exclude PPN';
  } else {
    globalTaxSwitchBtn.textContent = 'All: Exc';
    globalTaxSwitchBtn.classList.remove('mode-include');
    globalTaxSwitchBtn.title = 'Klik untuk switch tampilan semua varian ke Include PPN 12%';
  }
}

function updateVariantRowUI(arrIdx) {
  const item = scannedVariantRows[arrIdx];
  const refs = variantRowRefs[arrIdx];
  if (!item || !refs) return;

  const isRowActive = Boolean(item.isActive);
  const isIncMode = item.taxViewMode === 'include';
  const activeDigits = isIncMode ? item.includePrice : item.excludePrice;

  refs.priceInp.value = activeDigits ? formatRibuan(activeDigits) : '';
  refs.stockInp.value = item.stock;
  refs.statusChk.checked = isRowActive;

  // Kunci / buka input baris sesuai status aktif varian
  refs.stockInp.disabled = !isRowActive;
  refs.priceInp.disabled = !isRowActive;
  refs.taxBtn.disabled = !isRowActive;
  refs.tr.classList.toggle('variant-disabled', !isRowActive);
  refs.priceBox.classList.toggle('is-disabled', !isRowActive);

  refs.taxBtn.textContent = isIncMode ? 'Inc' : 'Exc';
  if (isIncMode) {
    refs.taxBtn.classList.add('mode-include');
    refs.taxBtn.title = 'Mode Include PPN 12% aktif. Klik untuk kembali ke Exclude PPN';
  } else {
    refs.taxBtn.classList.remove('mode-include');
    refs.taxBtn.title = 'Klik untuk convert dari Include PPN 12% atau preview mode Include PPN 12%';
  }

  // Update teks Rentang Harga Wajar sesuai mode pajak baris
  if (refs.hintSpan && item.priceHint) {
    if (isIncMode && item.minExclude > 0 && item.maxExclude > 0) {
      const minInc = Math.round(item.minExclude * 1.11);
      const maxInc = Math.round(item.maxExclude * 1.11);
      refs.hintSpan.textContent = `Rentang harga wajar : ${formatRupiahDec(minInc)} - ${formatRupiahDec(maxInc)} (Include PPN 12%)`;
      refs.hintSpan.classList.add('is-include-mode');
    } else {
      refs.hintSpan.textContent = item.priceHint;
      refs.hintSpan.classList.remove('is-include-mode');
    }
  }

  // Validasi batas harga wajar (abaikan pesan alarm & warna merah jika status varian OFF)
  if (refs.errSpan) {
    const errMsg = getVariantPriceError(item);

    if (errMsg) {
      refs.errSpan.textContent = errMsg;
      refs.errSpan.style.display = 'block';
      refs.priceBox.classList.add('has-error');
    } else {
      refs.errSpan.textContent = '';
      refs.errSpan.style.display = 'none';
      refs.priceBox.classList.remove('has-error');
    }
  }
}

// Tombol Switch Global Exc/Inc untuk semua varian sekaligus
globalTaxSwitchBtn.addEventListener('click', () => {
  if (scannedVariantRows.length === 0) return;

  if (globalVariantTaxMode === 'exclude') {
    const hasPendingRawConvert = scannedVariantRows.some(
      (r) => r.taxViewMode === 'exclude' && r.awaitingRawConvert && r.excludePrice
    );

    if (hasPendingRawConvert) {
      scannedVariantRows.forEach((row, idx) => {
        if (row.taxViewMode === 'exclude' && row.awaitingRawConvert && row.excludePrice) {
          const rawTypedInc = parseInt(row.excludePrice, 10);
          row.includePrice = String(rawTypedInc);
          row.excludePrice = String(customRound(rawTypedInc / 1.11));
          row.awaitingRawConvert = false;
        }
        updateVariantRowUI(idx);
      });
    } else {
      globalVariantTaxMode = 'include';
      scannedVariantRows.forEach((row, idx) => {
        row.taxViewMode = 'include';
        row.awaitingRawConvert = false;
        updateVariantRowUI(idx);
      });
    }
  } else {
    globalVariantTaxMode = 'exclude';
    scannedVariantRows.forEach((row, idx) => {
      row.taxViewMode = 'exclude';
      row.awaitingRawConvert = false;
      updateVariantRowUI(idx);
    });
  }

  syncGlobalTaxButtonUI();
  saveRefStateToStorage();
});

// Tombol "Off" di header kolom Status: menonaktifkan semua status varian
disableAllStatusBtn.addEventListener('click', () => {
  if (scannedVariantRows.length === 0) return;
  scannedVariantRows.forEach((row, idx) => {
    row.isActive = false;
    updateVariantRowUI(idx);
  });
  saveRefStateToStorage();
});

// Format angka ribuan pada input Harga di Pengatur Sekaligus
bulkPriceInput.addEventListener('input', (e) => {
  const clean = e.target.value.replace(/\D/g, '');
  e.target.value = clean ? formatRibuan(clean) : '';
});

bulkStockInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

// Tombol "Terapkan Ke Semua" di area Pengatur Sekaligus
applyBulkVariantBtn.addEventListener('click', () => {
  if (scannedVariantRows.length === 0) return;
  const bulkStock = bulkStockInput.value.replace(/\D/g, '');
  const bulkPrice = bulkPriceInput.value.replace(/\D/g, '');

  if (!bulkStock && !bulkPrice) return;

  scannedVariantRows.forEach((row, idx) => {
    if (bulkStock !== '') {
      row.stock = bulkStock;
    }
    if (bulkPrice !== '') {
      if (row.taxViewMode === 'include') {
        row.includePrice = bulkPrice;
        row.excludePrice = String(customRound(parseInt(bulkPrice, 10) / 1.11));
        row.awaitingRawConvert = false;
      } else {
        row.excludePrice = bulkPrice;
        row.includePrice = String(Math.round(parseInt(bulkPrice, 10) * 1.11));
        row.awaitingRawConvert = true;
      }
    }
    updateVariantRowUI(idx);
  });
  saveRefStateToStorage();
});

// Tombol "Isi Harga Terendah" untuk semua varian
fillMinPriceAllBtn.addEventListener('click', () => {
  if (scannedVariantRows.length === 0) return;
  scannedVariantRows.forEach((row, idx) => {
    if (row.minExclude > 0) {
      row.excludePrice = String(row.minExclude);
      row.includePrice = String(Math.round(row.minExclude * 1.11));
      row.awaitingRawConvert = false;
      updateVariantRowUI(idx);
    }
  });
  saveRefStateToStorage();
});

// Tombol "Isi Harga Tertinggi" untuk semua varian
fillMaxPriceAllBtn.addEventListener('click', () => {
  if (scannedVariantRows.length === 0) return;
  scannedVariantRows.forEach((row, idx) => {
    if (row.maxExclude > 0) {
      row.excludePrice = String(row.maxExclude);
      row.includePrice = String(Math.round(row.maxExclude * 1.11));
      row.awaitingRawConvert = false;
      updateVariantRowUI(idx);
    }
  });
  saveRefStateToStorage();
});

autoUploadImgCheck.addEventListener('change', () => {
  saveRefStateToStorage();
});

function buildVariantTableDOM(headerName, normalizedRows) {
  currentVariantHeaderName = headerName || 'Varian';
  variantColHeader.textContent = currentVariantHeaderName;
  variantCountBadge.textContent = `${normalizedRows.length}`;
  variantEditorBody.innerHTML = '';
  variantRowRefs = [];
  scannedVariantRows = normalizedRows;

  scannedVariantRows.forEach((item, arrIdx) => {
    const tr = document.createElement('tr');

    // Kolom 1: Nama Varian (mendukung 1 maupun 2+ tipe varian bertumpuk rapi)
    const tdName = document.createElement('td');
    tdName.className = 'var-name-cell';
    const valuesList = Array.isArray(item.variantValues) && item.variantValues.length > 0
      ? item.variantValues
      : [item.name];

    const primarySpan = document.createElement('span');
    primarySpan.className = 'var-primary-name';
    primarySpan.textContent = valuesList[0];
    tdName.appendChild(primarySpan);

    valuesList.slice(1).forEach((subVal) => {
      const subSpan = document.createElement('span');
      subSpan.className = 'var-sub-name';
      subSpan.textContent = subVal;
      tdName.appendChild(subSpan);
    });

    // Kolom 2: Stok (Editable)
    const tdStock = document.createElement('td');
    const stockInp = document.createElement('input');
    stockInp.type = 'text';
    stockInp.inputMode = 'numeric';
    stockInp.className = 'var-input-stock';
    stockInp.placeholder = '0';
    stockInp.addEventListener('input', (e) => {
      const clean = e.target.value.replace(/\D/g, '');
      e.target.value = clean;
      scannedVariantRows[arrIdx].stock = clean;
      saveRefStateToStorage();
    });
    tdStock.appendChild(stockInp);

    // Kolom 3: Harga (Editable) + Tombol Rounded Rectangle Switch Exc/Inc + Rentang Harga Wajar + Pesan Alarm Merah
    const tdPrice = document.createElement('td');
    tdPrice.className = 'var-price-col';

    const priceBox = document.createElement('div');
    priceBox.className = 'var-price-box';

    const rpSpan = document.createElement('span');
    rpSpan.className = 'var-price-prefix';
    rpSpan.textContent = 'Rp';

    const priceInp = document.createElement('input');
    priceInp.type = 'text';
    priceInp.inputMode = 'numeric';
    priceInp.className = 'var-input-price';
    priceInp.placeholder = 'Harga';

    const taxBtn = document.createElement('button');
    taxBtn.type = 'button';
    taxBtn.className = 'btn-tax-switch';
    taxBtn.textContent = 'Exc';

    priceInp.addEventListener('input', (e) => {
      const clean = e.target.value.replace(/\D/g, '');
      e.target.value = clean ? formatRibuan(clean) : '';

      const row = scannedVariantRows[arrIdx];
      if (!clean) {
        row.excludePrice = '';
        row.includePrice = '';
        row.awaitingRawConvert = false;
      } else if (row.taxViewMode === 'include') {
        row.includePrice = clean;
        row.excludePrice = String(customRound(parseInt(clean, 10) / 1.11));
        row.awaitingRawConvert = false;
      } else {
        row.excludePrice = clean;
        row.includePrice = String(Math.round(parseInt(clean, 10) * 1.11));
        row.awaitingRawConvert = true;
      }
      updateVariantRowUI(arrIdx);
      saveRefStateToStorage();
    });

    taxBtn.addEventListener('click', () => {
      const row = scannedVariantRows[arrIdx];
      if (!row.isActive) return;

      if (row.taxViewMode === 'exclude') {
        if (row.awaitingRawConvert && row.excludePrice) {
          const rawTypedInc = parseInt(row.excludePrice, 10);
          row.includePrice = String(rawTypedInc);
          row.excludePrice = String(customRound(rawTypedInc / 1.11));
          row.awaitingRawConvert = false;
          row.taxViewMode = 'exclude';
        } else {
          row.taxViewMode = 'include';
        }
      } else {
        row.taxViewMode = 'exclude';
      }
      updateVariantRowUI(arrIdx);
      syncGlobalTaxButtonUI();
      saveRefStateToStorage();
    });

    priceBox.appendChild(rpSpan);
    priceBox.appendChild(priceInp);
    priceBox.appendChild(taxBtn);
    tdPrice.appendChild(priceBox);

    // Pesan alarm merah jika harga keluar dari batas wajar
    const errSpan = document.createElement('span');
    errSpan.className = 'var-price-error';
    tdPrice.appendChild(errSpan);

    // Keterangan Rentang harga wajar tepat di bawah kolom harga
    let hintSpan = null;
    if (item.priceHint) {
      hintSpan = document.createElement('span');
      hintSpan.className = 'var-hint-text';
      hintSpan.textContent = item.priceHint;
      tdPrice.appendChild(hintSpan);
    }

    // Kolom 4: Toggle Status (Tanpa teks Aktif/Nonaktif, mendukung Ctrl+Left Click)
    const tdStatus = document.createElement('td');
    tdStatus.className = 'var-status-cell';

    const switchLbl = document.createElement('label');
    switchLbl.className = 'switch-toggle';
    switchLbl.title = 'Klik: ubah status | Ctrl+Klik: aktifkan hanya varian ini';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = item.isActive;

    const slider = document.createElement('span');
    slider.className = 'switch-slider';

    // Hidden shortcut: Ctrl + Left Click -> hanya varian ini yang aktif, lainnya nonaktif
    switchLbl.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        scannedVariantRows.forEach((row, idx) => {
          row.isActive = idx === arrIdx;
          updateVariantRowUI(idx);
        });
        renderAlert(refStatus, true, '');
        saveRefStateToStorage();
      }
    });

    chk.addEventListener('change', (e) => {
      scannedVariantRows[arrIdx].isActive = e.target.checked;
      updateVariantRowUI(arrIdx);
      if (e.target.checked) {
        renderAlert(refStatus, true, '');
      }
      saveRefStateToStorage();
    });

    switchLbl.appendChild(chk);
    switchLbl.appendChild(slider);
    tdStatus.appendChild(switchLbl);

    tr.appendChild(tdName);
    tr.appendChild(tdStock);
    tr.appendChild(tdPrice);
    tr.appendChild(tdStatus);
    variantEditorBody.appendChild(tr);

    variantRowRefs.push({
      tr,
      stockInp,
      priceBox,
      priceInp,
      taxBtn,
      errSpan,
      hintSpan,
      statusChk: chk
    });

    updateVariantRowUI(arrIdx);
  });

  syncGlobalTaxButtonUI();
  variantEditorSection.style.display = 'block';
}

function renderEditableVariantTable(headerName, rows, defaultExcludePrice, defaultIncludePrice) {
  bulkStockInput.value = '';
  bulkPriceInput.value = '';
  globalVariantTaxMode = 'exclude';

  const normalized = rows.map((row) => {
    const existingPriceDigits = String(row.price || '').replace(/\D/g, '');
    const usedDefault = !existingPriceDigits && defaultExcludePrice > 0;
    const initialExcDigits = existingPriceDigits || (defaultExcludePrice > 0 ? String(defaultExcludePrice) : '');
    const initialIncDigits = usedDefault && defaultIncludePrice > 0
      ? String(defaultIncludePrice)
      : (initialExcDigits ? String(Math.round(parseInt(initialExcDigits, 10) * 1.11)) : '');
    const range = parsePriceHintRange(row.priceHint || '');

    return {
      index: row.index,
      name: row.name,
      variantValues: Array.isArray(row.variantValues) && row.variantValues.length > 0
        ? row.variantValues
        : [row.name],
      stock: String(row.stock || '').replace(/\D/g, ''),
      excludePrice: initialExcDigits,
      includePrice: initialIncDigits,
      taxViewMode: 'exclude',
      awaitingRawConvert: Boolean(existingPriceDigits),
      isActive: Boolean(row.isActive),
      priceHint: row.priceHint || '',
      minExclude: range.min,
      maxExclude: range.max
    };
  });

  buildVariantTableDOM(headerName, normalized);
}

// Pulihkan data referensi, tabel varian, dan ukuran tinggi area saat Side Panel dibuka kembali
chrome.storage.local.get([REF_STORAGE_KEY, UI_LAYOUT_STORAGE_KEY], (res) => {
  if (res[UI_LAYOUT_STORAGE_KEY]) {
    panelLayoutState = { ...panelLayoutState, ...res[UI_LAYOUT_STORAGE_KEY] };
  }
  applyPanelLayoutUI();

  const saved = res[REF_STORAGE_KEY];
  if (!saved || !saved.grabbedRefData) return;

  grabbedRefData = saved.grabbedRefData;
  matchedTargets = Array.isArray(saved.matchedTargets) ? saved.matchedTargets : [];
  matchedValuesMap = saved.matchedValuesMap || {};
  matchedPreviewItems = Array.isArray(saved.matchedPreviewItems) ? saved.matchedPreviewItems : [];
  matchSummaryLabel = saved.matchSummaryLabel || '';
  currentVariantHeaderName = saved.currentVariantHeaderName || 'Varian';
  globalVariantTaxMode = saved.globalVariantTaxMode || 'exclude';

  if (typeof saved.autoUploadChecked === 'boolean') {
    autoUploadImgCheck.checked = saved.autoUploadChecked;
  }

  renderRefSummaryUI(grabbedRefData);

  if (matchedPreviewItems.length > 0 || (Array.isArray(saved.scannedVariantRows) && saved.scannedVariantRows.length > 0)) {
    renderMatchedListUI(matchedPreviewItems, matchSummaryLabel);
    if (Array.isArray(saved.scannedVariantRows) && saved.scannedVariantRows.length > 1) {
      buildVariantTableDOM(currentVariantHeaderName, saved.scannedVariantRows);
    }
  }
});

// Langkah 1: Scan Halaman Referensi Produk
scanRefBtn.addEventListener('click', () => {
  scanRefBtn.disabled = true;
  renderAlert(refStatus, true, '');

  chrome.runtime.sendMessage({ action: 'SCRAPE_INAPROC_REF' }, (res) => {
    scanRefBtn.disabled = false;

    if (chrome.runtime.lastError) {
      renderAlert(refStatus, false, chrome.runtime.lastError.message);
      return;
    }
    if (!res || !res.ok || !res.reference) {
      renderAlert(refStatus, false, res?.msg || 'Gagal membaca data referensi.');
      return;
    }

    grabbedRefData = res.reference;
    matchedTargets = [];
    matchedValuesMap = {};
    matchedPreviewItems = [];
    matchSummaryLabel = '';
    scannedVariantRows = [];
    variantRowRefs = [];
    globalVariantTaxMode = 'exclude';
    variantEditorSection.style.display = 'none';
    matchPreviewBox.style.display = 'none';

    renderRefSummaryUI(grabbedRefData);
    saveRefStateToStorage();
    renderAlert(refStatus, true, 'Referensi tersimpan! Silakan pindah ke tab Tambah Produk, pilih kategori, lalu klik Langkah 2.');
  });
});

// Langkah 2: Scan Form Add Product & Auto-Matching
scanMatchFormBtn.addEventListener('click', () => {
  if (!grabbedRefData) {
    renderAlert(refStatus, false, 'Silakan scan halaman referensi terlebih dahulu.');
    return;
  }

  scanMatchFormBtn.disabled = true;
  renderAlert(refStatus, true, '');

  chrome.runtime.sendMessage({ action: 'SCAN_ADD_FORM_ALL' }, (res) => {
    scanMatchFormBtn.disabled = false;

    if (chrome.runtime.lastError) {
      renderAlert(refStatus, false, chrome.runtime.lastError.message);
      return;
    }
    if (!res || !res.ok || !Array.isArray(res.fields) || res.fields.length === 0) {
      renderAlert(refStatus, false, 'Form tambah produk tidak ditemukan. Pastikan kategori sudah dipilih.');
      return;
    }

    const isProviderMaster = Boolean(res.isFormMasterProduct);
    const effectiveBrand = isProviderMaster
      ? grabbedRefData.productName.slice(0, 20).trim()
      : grabbedRefData.brandValue;

    const excludePriceVal = grabbedRefData.includePrice > 0
      ? customRound(grabbedRefData.includePrice / 1.11)
      : 0;

    matchedTargets = [];
    matchedValuesMap = {};
    matchedPreviewItems = [];
    scannedVariantRows = [];
    variantRowRefs = [];
    variantEditorSection.style.display = 'none';

    const refSpecsEntries = Object.entries(grabbedRefData.specs || {});

    function findSpecMatch(formLabel) {
      const cleanForm = formLabel.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (!cleanForm) return '';

      for (const [k, v] of refSpecsEntries) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        if (cleanK === cleanForm) return v;
      }
      for (const [k, v] of refSpecsEntries) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        if (cleanK.length >= 3 && (cleanK.includes(cleanForm) || cleanForm.includes(cleanK))) {
          return v;
        }
      }
      return '';
    }

    res.fields.forEach((field) => {
      const lblLower = field.label.toLowerCase();
      let matchedVal = '';
      let previewDisplayVal = '';

      if (field.key === 'name') {
        matchedVal = grabbedRefData.productName;
      } else if (field.key === 'description') {
        matchedVal = grabbedRefData.description;
      } else if (field.key === 'brand_application_number') {
        if (!isProviderMaster && grabbedRefData.brandApplicationNumber) {
          matchedVal = grabbedRefData.brandApplicationNumber;
          previewDisplayVal = grabbedRefData.brandValue
            ? `${grabbedRefData.brandApplicationNumber} (${grabbedRefData.brandValue})`
            : grabbedRefData.brandApplicationNumber;
        }
      } else if (field.key === 'kbki_code') {
        matchedVal = grabbedRefData.kbkiCode;
      } else if (field.key === 'select_klasifikasi') {
        matchedVal = grabbedRefData.productOrigin;
      } else if (field.key === 'select_asal_negara') {
        if (grabbedRefData.productOrigin === 'Import' && grabbedRefData.countryOfOrigin) {
          matchedVal = grabbedRefData.countryOfOrigin;
        }
      } else if (field.key === 'select_sertifikat_telekomunikasi') {
        matchedVal = grabbedRefData.telecomCert;
      } else if (field.key === 'select_struktur_harga') {
        matchedVal = grabbedRefData.priceStructure;
      } else if (field.key === 'select_ramah_lingkungan') {
        matchedVal = grabbedRefData.ecoLabel;
      } else if (field.key === 'select_satuan_produk') {
        matchedVal = grabbedRefData.productUnit;
      } else if (lblLower === 'spesifikasi produk' || lblLower.includes('spesifikasi')) {
        matchedVal = grabbedRefData.productSpec || findSpecMatch(field.label);
      } else if (lblLower === 'merek' || lblLower.includes('merek') || lblLower.includes('brand')) {
        matchedVal = effectiveBrand;
      } else if (lblLower.includes('garansi')) {
        matchedVal = grabbedRefData.warranty || findSpecMatch(field.label);
      } else if (lblLower.includes('kelengkapan')) {
        matchedVal = grabbedRefData.kelengkapan || findSpecMatch(field.label);
      } else if (field.type === 'single-price' || field.key.toLowerCase().includes('price') || lblLower === 'harga produk' || lblLower === 'harga') {
        if (excludePriceVal > 0) {
          previewDisplayVal = `Rp ${formatRibuan(String(excludePriceVal))} (Exclude PPN dari Rp ${formatRibuan(String(grabbedRefData.includePrice))})`;
          matchedVal = String(excludePriceVal);
        }
      } else if (field.key === 'shipping.weight') {
        if (grabbedRefData.weightGrams) {
          previewDisplayVal = grabbedRefData.weightDisplay || `${grabbedRefData.weightGrams} gr`;
          matchedVal = grabbedRefData.weightGrams;
        }
      } else if (field.key === 'shipping.length') {
        matchedVal = grabbedRefData.lengthCm;
      } else if (field.key === 'shipping.width') {
        matchedVal = grabbedRefData.widthCm;
      } else if (field.key === 'shipping.height') {
        matchedVal = grabbedRefData.heightCm;
      } else {
        matchedVal = findSpecMatch(field.label);
      }

      const trimmedVal = String(matchedVal || '').trim();
      const allowDash = Boolean(field.isMainInfoRequired);
      const isValidVal = trimmedVal !== '' && (trimmedVal !== '-' || allowDash);

      if (isValidVal) {
        matchedTargets.push(field);
        matchedValuesMap[field.key] = trimmedVal;

        const rawPreview = previewDisplayVal || trimmedVal;
        const displayVal = rawPreview.length > 65
          ? rawPreview.slice(0, 65) + '...'
          : rawPreview;

        matchedPreviewItems.push({
          label: field.label,
          displayVal
        });
      }
    });

    const hasMultiVariants = isProviderMaster && Array.isArray(res.variantRows) && res.variantRows.length > 1;
    if (hasMultiVariants) {
      renderEditableVariantTable(
        res.variantHeaderName,
        res.variantRows,
        excludePriceVal,
        grabbedRefData.includePrice
      );
    }

    if (matchedTargets.length === 0 && !hasMultiVariants) {
      renderAlert(refStatus, false, 'Tidak ada kolom yang cocok ditemukan. Pastikan kategori produk sudah dipilih.');
      return;
    }

    const modeTag = isProviderMaster ? ' [Master Product]' : '';
    const variantTag = hasMultiVariants ? ` + ${scannedVariantRows.length} Varian` : '';
    matchSummaryLabel = `Cocok ${matchedTargets.length} kolom${variantTag} (${res.category || 'Form'})${modeTag}:`;
    renderMatchedListUI(matchedPreviewItems, matchSummaryLabel);
    applyPanelLayoutUI();
    saveRefStateToStorage();
  });
});

// Langkah 3: Confirm & Eksekusi Pengisian + Update Varian (selalu Exclude PPN) + Upload Semua Foto Produk
confirmRefFillBtn.addEventListener('click', () => {
  if (matchedTargets.length === 0 && scannedVariantRows.length === 0) return;

  if (scannedVariantRows.length > 0 && !scannedVariantRows.some((v) => v.isActive)) {
    renderAlert(
      refStatus,
      false,
      'Peringatan: Minimal harus ada 1 varian produk yang aktif (menyala) sebelum mengisi ke form.'
    );
    variantEditorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // Validasi batas harga wajar khusus varian yang sedang berstatus ON (aktif)
  const invalidActiveVariants = [];
  scannedVariantRows.forEach((row, idx) => {
    const errMsg = getVariantPriceError(row);
    if (errMsg) {
      invalidActiveVariants.push({ idx, name: row.name, errMsg });
    }
  });

  if (invalidActiveVariants.length > 0) {
    const namesList = invalidActiveVariants.map((v) => v.name).join(', ');
    renderAlert(
      refStatus,
      false,
      `Peringatan: Harga pada varian aktif (${namesList}) berada di luar batas harga wajar. Perbaiki harga atau matikan status varian terlebih dahulu.`
    );
    variantEditorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const firstBadRef = variantRowRefs[invalidActiveVariants[0].idx];
    if (firstBadRef && firstBadRef.tr) {
      firstBadRef.tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  confirmRefFillBtn.disabled = true;
  confirmRefFillBtn.innerHTML = '<span>Mengisi form, varian & dropdown...</span>';
  renderAlert(refStatus, true, '');

  const variantPayload = scannedVariantRows.map((row) => ({
    index: row.index,
    name: row.name,
    stock: row.stock,
    price: row.excludePrice,
    isActive: row.isActive
  }));

  chrome.runtime.sendMessage(
    {
      action: 'FILL_FORM_FIELDS',
      payload: {
        targets: matchedTargets,
        aiData: matchedValuesMap,
        variantRows: variantPayload
      }
    },
    (fillRes) => {
      if (chrome.runtime.lastError) {
        confirmRefFillBtn.disabled = false;
        confirmRefFillBtn.innerHTML = '<span>3. Confirm & Isi Semua ke Form</span>';
        renderAlert(refStatus, false, chrome.runtime.lastError.message);
        return;
      }

      const baseMsg = fillRes?.msg || 'Form selesai diisi.';
      const imgs = grabbedRefData?.imageUrls || [];

      if (autoUploadImgCheck.checked && imgs.length > 0) {
        confirmRefFillBtn.innerHTML = `<span>Mengunggah ${imgs.length} foto produk...</span>`;
        chrome.runtime.sendMessage(
          { action: 'UPLOAD_REF_IMAGES', imageUrls: imgs },
          (imgRes) => {
            confirmRefFillBtn.disabled = false;
            confirmRefFillBtn.innerHTML = '<span>3. Confirm & Isi Semua ke Form</span>';
            const imgNote = imgRes?.ok ? ` + ${imgRes.msg}` : ` (${imgRes?.msg || 'Foto gagal diunggah'})`;
            renderAlert(refStatus, true, baseMsg + imgNote);
          }
        );
      } else {
        confirmRefFillBtn.disabled = false;
        confirmRefFillBtn.innerHTML = '<span>3. Confirm & Isi Semua ke Form</span>';
        renderAlert(refStatus, true, baseMsg);
      }
    }
  );
});

clearRefBtn.addEventListener('click', () => {
  grabbedRefData = null;
  matchedTargets = [];
  matchedValuesMap = {};
  matchedPreviewItems = [];
  matchSummaryLabel = '';
  scannedVariantRows = [];
  variantRowRefs = [];
  globalVariantTaxMode = 'exclude';
  matchList.innerHTML = '';
  refThumbsRow.innerHTML = '';
  variantEditorBody.innerHTML = '';
  variantEditorSection.style.display = 'none';
  matchPreviewBox.style.display = 'none';
  refResultBox.style.display = 'none';
  renderAlert(refStatus, true, '');
  chrome.storage.local.remove(REF_STORAGE_KEY);
});

// ==========================================
// 3. LOGIKA AUTO TOGGLE VARIAN INAPROC (EXISTING)
// ==========================================
const toggleVarianBtn = document.getElementById('toggleVarianBtn');
const varianStatus = document.getElementById('varianStatus');

toggleVarianBtn.addEventListener('click', () => {
  toggleVarianBtn.disabled = true;
  renderAlert(varianStatus, true, '');

  chrome.runtime.sendMessage({ action: 'RUN_VARIAN_TOGGLE' }, (response) => {
    toggleVarianBtn.disabled = false;
    if (chrome.runtime.lastError) {
      renderAlert(varianStatus, false, chrome.runtime.lastError.message);
      return;
    }
    renderAlert(varianStatus, response.ok, response.msg);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'VARIAN_RESULT_FROM_SHORTCUT' && message.result) {
    renderAlert(varianStatus, message.result.ok, message.result.msg);
  }
});

// ==========================================
// 4. PENGATURAN PROVIDER AI & AUTO-FILL (EXISTING)
// ==========================================
const toggleSettingsLink = document.getElementById('toggleSettingsLink');
const activeProviderBadge = document.getElementById('activeProviderBadge');
const aiSettingsSection = document.getElementById('aiSettingsSection');
const providerSelect = document.getElementById('providerSelect');

const geminiConfigBox = document.getElementById('geminiConfigBox');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const saveGeminiBtn = document.getElementById('saveGeminiBtn');

const routerConfigBox = document.getElementById('routerConfigBox');
const routerBaseUrlInput = document.getElementById('routerBaseUrl');
const routerApiKeyInput = document.getElementById('routerApiKey');
const routerModelSelect = document.getElementById('routerModelSelect');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const testRouterBtn = document.getElementById('testRouterBtn');
const saveRouterBtn = document.getElementById('saveRouterBtn');

const scanFormBtn = document.getElementById('scanFormBtn');
const scanBox = document.getElementById('scanBox');
const scanSummary = document.getElementById('scanSummary');
const pillList = document.getElementById('pillList');
const productQueryInput = document.getElementById('productQueryInput');
const generateFillBtn = document.getElementById('generateFillBtn');
const clearAiBtn = document.getElementById('clearAiBtn');
const aiStatus = document.getElementById('aiStatus');

let scannedTargets = [];
let scannedCategory = "";
let rateLimitTimer = null;

function updateProviderUI(provider) {
  if (provider === '9router') {
    geminiConfigBox.style.display = 'none';
    routerConfigBox.style.display = 'block';
    activeProviderBadge.textContent = '9Router';
  } else {
    geminiConfigBox.style.display = 'block';
    routerConfigBox.style.display = 'none';
    activeProviderBadge.textContent = 'Gemini';
  }
}

function populateModelDropdown(models, selectedModel) {
  routerModelSelect.innerHTML = '';
  if (!Array.isArray(models) || models.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Klik Refresh Model --';
    routerModelSelect.appendChild(opt);
    return;
  }

  models.forEach((modelId) => {
    const opt = document.createElement('option');
    opt.value = modelId;
    opt.textContent = modelId;
    if (selectedModel && modelId === selectedModel) {
      opt.selected = true;
    }
    routerModelSelect.appendChild(opt);
  });
}

chrome.storage.local.get(
  ['aiProvider', 'geminiApiKey', 'routerBaseUrl', 'routerApiKey', 'routerModel', 'routerModelsCache'],
  (res) => {
    const savedProvider = res.aiProvider || 'gemini';
    providerSelect.value = savedProvider;
    updateProviderUI(savedProvider);

    if (res.geminiApiKey) geminiApiKeyInput.value = res.geminiApiKey;
    if (res.routerBaseUrl) routerBaseUrlInput.value = res.routerBaseUrl;
    if (res.routerApiKey) routerApiKeyInput.value = res.routerApiKey;
    if (res.routerModelsCache) {
      populateModelDropdown(res.routerModelsCache, res.routerModel);
    }

    if (savedProvider === 'gemini' && !res.geminiApiKey) {
      aiSettingsSection.style.display = 'flex';
    } else if (savedProvider === '9router' && (!res.routerApiKey || !res.routerModel)) {
      aiSettingsSection.style.display = 'flex';
    }
  }
);

toggleSettingsLink.addEventListener('click', () => {
  aiSettingsSection.style.display = aiSettingsSection.style.display === 'none' ? 'flex' : 'none';
});

providerSelect.addEventListener('change', (e) => {
  const chosen = e.target.value;
  updateProviderUI(chosen);
  chrome.storage.local.set({ aiProvider: chosen });
  renderAlert(aiStatus, true, '');
});

function clearRateLimitLock() {
  if (rateLimitTimer) {
    clearInterval(rateLimitTimer);
    rateLimitTimer = null;
    generateFillBtn.disabled = false;
    generateFillBtn.innerHTML = '<span>2. Generate AI & Isi Otomatis</span>';
  }
}

saveGeminiBtn.addEventListener('click', () => {
  const key = geminiApiKeyInput.value.trim();
  if (!key) {
    renderAlert(aiStatus, false, 'API Key Gemini tidak boleh kosong.');
    return;
  }
  chrome.storage.local.set({ aiProvider: 'gemini', geminiApiKey: key }, () => {
    aiSettingsSection.style.display = 'none';
    clearRateLimitLock();
    renderAlert(aiStatus, true, 'Pengaturan Google Gemini berhasil disimpan!');
    setTimeout(() => renderAlert(aiStatus, true, ''), 2000);
  });
});

refreshModelsBtn.addEventListener('click', () => {
  const baseUrl = routerBaseUrlInput.value.trim() || 'http://localhost:20128/v1';
  const apiKey = routerApiKeyInput.value.trim();

  if (!apiKey) {
    renderAlert(aiStatus, false, 'Masukkan API Key 9Router terlebih dahulu sebelum mengambil model.');
    return;
  }

  refreshModelsBtn.disabled = true;
  refreshModelsBtn.textContent = '...';
  renderAlert(aiStatus, true, '');

  chrome.runtime.sendMessage(
    { action: 'FETCH_9ROUTER_MODELS', payload: { baseUrl, apiKey } },
    (res) => {
      refreshModelsBtn.disabled = false;
      refreshModelsBtn.textContent = 'Refresh';

      if (chrome.runtime.lastError) {
        renderAlert(aiStatus, false, chrome.runtime.lastError.message);
        return;
      }
      if (!res || !res.ok) {
        renderAlert(aiStatus, false, res?.msg || 'Gagal mengambil daftar model dari 9Router.');
        return;
      }

      const currentSelected = routerModelSelect.value;
      populateModelDropdown(res.models, currentSelected);
      chrome.storage.local.set({ routerModelsCache: res.models });
      renderAlert(aiStatus, true, `Berhasil memuat ${res.models.length} model dari 9Router.`);
    }
  );
});

testRouterBtn.addEventListener('click', () => {
  const baseUrl = routerBaseUrlInput.value.trim() || 'http://localhost:20128/v1';
  const apiKey = routerApiKeyInput.value.trim();
  const model = routerModelSelect.value;

  if (!apiKey) {
    renderAlert(aiStatus, false, 'Masukkan API Key 9Router terlebih dahulu.');
    return;
  }

  testRouterBtn.disabled = true;
  testRouterBtn.textContent = 'Menguji...';
  renderAlert(aiStatus, true, '');

  chrome.runtime.sendMessage(
    { action: 'TEST_9ROUTER_CONNECTION', payload: { baseUrl, apiKey, model } },
    (res) => {
      testRouterBtn.disabled = false;
      testRouterBtn.textContent = 'Test Connection';

      if (chrome.runtime.lastError) {
        renderAlert(aiStatus, false, chrome.runtime.lastError.message);
        return;
      }
      if (!res || !res.ok) {
        renderAlert(aiStatus, false, res?.msg || 'Test Connection gagal.');
        return;
      }

      if (res.models) {
        populateModelDropdown(res.models, model);
        chrome.storage.local.set({ routerModelsCache: res.models });
      }
      renderAlert(aiStatus, true, res.msg);
    }
  );
});

saveRouterBtn.addEventListener('click', () => {
  const baseUrl = routerBaseUrlInput.value.trim() || 'http://localhost:20128/v1';
  const apiKey = routerApiKeyInput.value.trim();
  const model = routerModelSelect.value;

  if (!apiKey) {
    renderAlert(aiStatus, false, 'API Key 9Router tidak boleh kosong.');
    return;
  }
  if (!model) {
    renderAlert(aiStatus, false, 'Pilih model 9Router terlebih dahulu (klik Refresh).');
    return;
  }

  chrome.storage.local.set(
    {
      aiProvider: '9router',
      routerBaseUrl: baseUrl,
      routerApiKey: apiKey,
      routerModel: model
    },
    () => {
      aiSettingsSection.style.display = 'none';
      clearRateLimitLock();
      renderAlert(aiStatus, true, `Pengaturan 9Router (${model}) berhasil disimpan!`);
      setTimeout(() => renderAlert(aiStatus, true, ''), 2500);
    }
  );
});

scanFormBtn.addEventListener('click', () => {
  scanFormBtn.disabled = true;
  renderAlert(aiStatus, true, '');

  chrome.runtime.sendMessage({ action: 'SCAN_TARGET_FIELDS' }, (response) => {
    scanFormBtn.disabled = false;

    if (chrome.runtime.lastError) {
      renderAlert(aiStatus, false, chrome.runtime.lastError.message);
      return;
    }
    if (!response || !response.ok || response.targets.length === 0) {
      renderAlert(aiStatus, false, 'Kolom target tidak ditemukan. Pastikan kategori produk sudah dipilih.');
      return;
    }

    scannedTargets = response.targets;
    scannedCategory = response.category || 'Umum';

    scanSummary.textContent = `Siap mengisi ${scannedTargets.length} kolom (${scannedCategory}):`;
    pillList.innerHTML = '';
    scannedTargets.forEach((t) => {
      const span = document.createElement('span');
      span.className = 'pill';
      span.textContent = t.label.split('(')[0].trim();
      pillList.appendChild(span);
    });

    clearAiBtn.style.display = 'none';
    scanBox.style.display = 'block';
    productQueryInput.focus();
  });
});

clearAiBtn.addEventListener('click', () => {
  scannedTargets = [];
  scannedCategory = "";
  productQueryInput.value = "";
  pillList.innerHTML = "";
  scanSummary.textContent = "";
  scanBox.style.display = 'none';
  clearAiBtn.style.display = 'none';
  renderAlert(aiStatus, true, '');
});

function lockGenerateButton(seconds, reasonMsg) {
  if (rateLimitTimer) clearInterval(rateLimitTimer);

  generateFillBtn.disabled = true;
  let remaining = seconds;

  renderAlert(aiStatus, false, `${reasonMsg} Tombol dikunci sementara (${remaining} detik).`);
  generateFillBtn.innerHTML = `<span>Terkunci (${remaining}d)</span>`;

  rateLimitTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(rateLimitTimer);
      rateLimitTimer = null;
      generateFillBtn.disabled = false;
      generateFillBtn.innerHTML = '<span>2. Generate AI & Isi Otomatis</span>';
      renderAlert(aiStatus, true, 'Batas waktu tunggu selesai. Silakan klik Generate kembali.');
      setTimeout(() => renderAlert(aiStatus, true, ''), 3000);
    } else {
      generateFillBtn.innerHTML = `<span>Terkunci (${remaining}d)</span>`;
    }
  }, 1000);
}

function parseAiJsonSafely(rawText) {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Respons AI bukan format JSON yang valid.');
  }
}

generateFillBtn.addEventListener('click', () => {
  const activeProvider = providerSelect.value || 'gemini';
  const geminiApiKey = geminiApiKeyInput.value.trim();
  const routerBaseUrl = routerBaseUrlInput.value.trim() || 'http://localhost:20128/v1';
  const routerApiKey = routerApiKeyInput.value.trim();
  const routerModel = routerModelSelect.value;

  if (activeProvider === 'gemini' && !geminiApiKey) {
    aiSettingsSection.style.display = 'flex';
    renderAlert(aiStatus, false, 'Masukkan & simpan Gemini API Key terlebih dahulu.');
    return;
  }

  if (activeProvider === '9router' && (!routerApiKey || !routerModel)) {
    aiSettingsSection.style.display = 'flex';
    renderAlert(aiStatus, false, 'Lengkapi API Key dan pilihan Model 9Router terlebih dahulu.');
    return;
  }

  const productName = productQueryInput.value.trim();
  if (!productName) {
    renderAlert(aiStatus, false, 'Masukkan nama/tipe barang terlebih dahulu.');
    productQueryInput.focus();
    return;
  }

  if (scannedTargets.length === 0) {
    renderAlert(aiStatus, false, 'Silakan klik Scan Kolom Target Form terlebih dahulu.');
    return;
  }

  generateFillBtn.disabled = true;
  generateFillBtn.innerHTML = `<span>Memproses via ${activeProvider === '9router' ? '9Router' : 'Gemini'}...</span>`;
  renderAlert(aiStatus, true, '');

  const properties = {};
  const requiredKeys = [];

  scannedTargets.forEach((field) => {
    requiredKeys.push(field.key);
    if (field.type === 'react-select-binary') {
      properties[field.key] = {
        type: "STRING",
        enum: ["Memiliki", "Tidak Memiliki"],
        description: field.label
      };
    } else {
      properties[field.key] = {
        type: "STRING",
        description: field.label
      };
    }
  });

  const systemInstruction = `Anda adalah asisten pengisian katalog produk resmi pemerintah Indonesia (INAPROC).
Tugas Anda adalah mengisi data spesifikasi produk secara akurat berdasarkan nama produk yang diberikan user.
ATURAN WAJIB:
1. "description": Buat deskripsi produk profesional dalam Bahasa Indonesia, maksimal 1800 karakter (tidak boleh lebih dari 2000 karakter).
2. Kolom "Tipe": Isi HANYA nama seri/model produk TANPA mereknya. Contoh: jika "Samsung Galaxy A53", isi "Galaxy A53". Jika "Lenovo ThinkPad X1 Carbon Gen 11", isi "ThinkPad X1 Carbon Gen 11".
3. Kolom "Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi": Pilih "Memiliki" jika produk tersebut adalah perangkat telekomunikasi/elektronik yang menggunakan frekuensi radio/seluler/WiFi/Bluetooth (seperti HP, Tablet, Laptop, Router, Modem, Access Point, HT, Smart TV), atau pilih "Tidak Memiliki" jika tidak terkait perangkat telekomunikasi.
4. Kolom "Kelengkapan Produk": Isi rincian isi paket dalam box standar pabrikan (misal: "1x Unit Tablet, 1x Kabel USB Type-C, 1x Adapter Charger, 1x Buku Panduan & Kartu Garansi").
5. Kolom Pengiriman (shipping.weight, shipping.length, shipping.width, shipping.height): Isi HANYA ANGKA estimasi berat paket beserta dus dalam GRAM (misal "850") dan dimensi dus luar dalam CM (misal panjang "28", lebar "19", tinggi "5").
6. Kolom spesifikasi teknis lainnya (Processor, RAM, Storage, Layar, Kamera, OS, Garansi, dll): Isi dengan spesifikasi teknis sebenarnya yang akurat dan ringkas.`;

  const userPrompt = `Kategori INAPROC: ${scannedCategory}\nNama Barang: ${productName}\n\nLengkapi seluruh field dalam format JSON sesuai skema.`;

  chrome.runtime.sendMessage(
    {
      action: 'GENERATE_AI_SPEC',
      payload: {
        provider: activeProvider,
        geminiApiKey,
        routerBaseUrl,
        routerApiKey,
        routerModel,
        systemInstruction,
        userPrompt,
        responseSchema: {
          type: "OBJECT",
          properties: properties,
          required: requiredKeys
        }
      }
    },
    (aiRes) => {
      if (chrome.runtime.lastError) {
        generateFillBtn.disabled = false;
        generateFillBtn.innerHTML = '<span>2. Generate AI & Isi Otomatis</span>';
        renderAlert(aiStatus, false, chrome.runtime.lastError.message);
        return;
      }

      if (!aiRes || !aiRes.ok) {
        if (aiRes?.isRateLimit) {
          lockGenerateButton(aiRes.lockSeconds || 60, aiRes.msg);
        } else {
          generateFillBtn.disabled = false;
          generateFillBtn.innerHTML = '<span>2. Generate AI & Isi Otomatis</span>';
          renderAlert(aiStatus, false, `Gagal: ${aiRes?.msg || 'Terjadi kesalahan pada AI.'}`);
        }
        return;
      }

      let aiData;
      try {
        aiData = parseAiJsonSafely(aiRes.rawText);
      } catch (parseErr) {
        generateFillBtn.disabled = false;
        generateFillBtn.innerHTML = '<span>2. Generate AI & Isi Otomatis</span>';
        renderAlert(aiStatus, false, `Gagal memproses output AI: ${parseErr.message}`);
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: 'FILL_FORM_FIELDS',
          payload: { targets: scannedTargets, aiData }
        },
        (fillRes) => {
          generateFillBtn.disabled = false;
          generateFillBtn.innerHTML = '<span>2. Generate AI & Isi Otomatis</span>';

          if (chrome.runtime.lastError) {
            renderAlert(aiStatus, false, chrome.runtime.lastError.message);
            return;
          }
          renderAlert(aiStatus, fillRes.ok, fillRes.msg);
          if (fillRes.ok) {
            clearAiBtn.style.display = 'flex';
          }
        }
      );
    }
  );
});

// ==========================================
// Credits
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const btnCredits = document.getElementById('btnToggleCredits');
  const boxCredits = document.getElementById('extCreditsBox');

  if (btnCredits && boxCredits) {
    btnCredits.addEventListener('click', () => {
      const isHidden = boxCredits.hasAttribute('hidden');
      if (isHidden) {
        boxCredits.removeAttribute('hidden');
        btnCredits.setAttribute('aria-expanded', 'true');
        boxCredits.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        boxCredits.setAttribute('hidden', '');
        btnCredits.setAttribute('aria-expanded', 'false');
      }
    });
  }
});