// Membuka Side Panel secara otomatis saat ikon ekstensi di toolbar diklik
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

// ==========================================
// FUNGSI 1: AUTO TOGGLE VARIAN (EXISTING)
// ==========================================
async function runVarianToggle() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = document.querySelector('#variant-table-container');
  if (!c) return { ok: false, msg: 'Tabel varian (#variant-table-container) tidak ditemukan' };

  const get = () => [...c.querySelectorAll('table tbody tr')]
    .map((tr) => tr.querySelector('input[type="checkbox"]'))
    .filter(Boolean);

  const inputs = get();
  const first = inputs[0];
  if (!first || !first.checked) {
    return { ok: false, msg: 'Varian pertama tidak ON, proses dibatalkan' };
  }

  const t0 = performance.now();
  inputs.slice(1).forEach((i) => { if (i.checked && !i.disabled) i.click(); });

  await sleep(100);
  const left = get().slice(1).filter((i) => i.checked && !i.disabled);
  if (left.length) {
    left.forEach((i) => i.click());
    await sleep(100);
  }

  const now = get();
  const on = now.filter((i) => i.checked).length;
  const msg = `Selesai: Total ${now.length}, ON ${on}, OFF ${now.length - on} (${Math.round(performance.now() - t0)} ms)`;
  return { ok: on >= 1, msg };
}

// ==========================================
// FUNGSI 2: SMART SCANNER AI AUTO-FILL (EXISTING)
// ==========================================
function scanTargetFields() {
  const targets = [];

  function extractCleanLabelText(lblEl) {
    if (!lblEl) return '';
    const firstSpan = lblEl.querySelector(':scope > span');
    const raw = (firstSpan ? firstSpan.innerText : lblEl.innerText) || '';
    return raw.trim().replace(/\n+/g, ' ').replace(/\s*\*\s*$/, '');
  }

  function getContextLabel(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const text = extractCleanLabelText(lbl);
      if (text) return text;
    }
    if (el.name) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.name)}"]`);
      const text = extractCleanLabelText(lbl);
      if (text) return text;
    }
    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const lbl = parent.querySelector('label');
      const text = extractCleanLabelText(lbl);
      if (text) return text;
      parent = parent.parentElement;
    }
    return '';
  }

  const allInputs = Array.from(document.querySelectorAll('input'));
  const catInput = allInputs.find(i => i.placeholder && i.placeholder.includes('Pilih Kategori'));
  const category = catInput ? catInput.value : '';

  const descEl = document.querySelector('textarea[name="description"]');
  if (descEl) {
    targets.push({
      key: 'description',
      label: 'Deskripsi Produk (Maksimal 2000 karakter)',
      type: 'textarea',
      selector: 'textarea[name="description"]'
    });
  }

  const mainInputs = Array.from(document.querySelectorAll('input[name^="productInformations.mainInformations."]'));
  mainInputs.forEach((el) => {
    const lbl = getContextLabel(el) || el.placeholder?.replace('Masukkan ', '') || el.name;
    targets.push({
      key: el.name,
      label: lbl,
      type: 'text',
      selector: `input[name="${el.name}"]`
    });
  });

  const reactSelectInputs = Array.from(document.querySelectorAll('input[id^="react-select-"]'));
  reactSelectInputs.forEach((el) => {
    if (el.id.includes('ppnPercentage')) return;
    const ctrlText = el.closest('[class*="-control"]')?.innerText || '';
    if (ctrlText.toLowerCase().includes('sertifikat alat telekomunikasi')) {
      targets.push({
        key: 'sertifikat_telekomunikasi',
        label: 'Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi',
        type: 'react-select-binary',
        selector: `#${CSS.escape(el.id)}`,
        controlHints: ['sertifikat alat telekomunikasi'],
        options: ['Memiliki', 'Tidak Memiliki']
      });
    }
  });

  const kelengkapanEl = document.querySelector('input[name="productInformations.additionalInformations.0.value"]');
  if (kelengkapanEl) {
    targets.push({
      key: 'productInformations.additionalInformations.0.value',
      label: 'Kelengkapan Produk (Isi dalam kemasan / in the box)',
      type: 'text',
      selector: 'input[name="productInformations.additionalInformations.0.value"]'
    });
  }

  const shippingMap = [
    { name: 'shipping.weight', label: 'Berat Produk (gr)' },
    { name: 'shipping.length', label: 'Dimensi (Panjang)' },
    { name: 'shipping.width', label: 'Dimensi (Lebar)' },
    { name: 'shipping.height', label: 'Dimensi (Tinggi)' }
  ];
  shippingMap.forEach((item) => {
    const el = document.querySelector(`input[name="${item.name}"]`);
    if (el) {
      targets.push({
        key: item.name,
        label: item.label,
        type: 'number-text',
        selector: `input[name="${item.name}"]`
      });
    }
  });

  return {
    ok: true,
    category,
    total: targets.length,
    targets
  };
}

// ==========================================
// FUNGSI 3: AUTO-FILL REACT INAPROC (INPUT + DROPDOWN + KBKI + MEREK PDKI + VARIAN)
// ==========================================
async function fillFormFields(payload) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { targets, aiData, variantRows } = payload;

  function setNativeValue(element, value, shouldBlur = true) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    if (shouldBlur) {
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }

  async function fillNumericCurrencyInput(el, digitsStr) {
    if (!el || el.disabled || el.readOnly) return false;
    el.focus();
    el.click();
    setNativeValue(el, digitsStr, false);
    await sleep(80);
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(60);

    // Pastikan tidak ter-reset oleh React Hook Form
    const currentDigits = String(el.value || '').replace(/\D/g, '');
    if (currentDigits !== digitsStr) {
      el.focus();
      setNativeValue(el, digitsStr, false);
      await sleep(80);
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    return true;
  }

  function findReactSelectByHints(field) {
    const allSelectInputs = Array.from(document.querySelectorAll('input[id^="react-select-"]'))
      .filter((el) => !el.disabled && !el.id.includes('ppnPercentage'));

    if (field.type === 'react-select-country') {
      const emptyBox = allSelectInputs.find((el) => {
        const txt = (el.closest('[class*="-control"]')?.innerText || '').trim();
        return txt === '';
      });
      if (emptyBox) return emptyBox;
    }

    if (Array.isArray(field.controlHints) && field.controlHints.length > 0) {
      const byHint = allSelectInputs.find((el) => {
        const txt = (el.closest('[class*="-control"]')?.innerText || '').toLowerCase().trim();
        return field.controlHints.some((h) => txt.includes(h.toLowerCase()));
      });
      if (byHint) return byHint;
    }

    if (field.selector) {
      const bySel = document.querySelector(field.selector);
      if (bySel && !bySel.disabled) return bySel;
    }

    return null;
  }

  async function selectReactOption(field, targetOptionText) {
    try {
      const inputEl = findReactSelectByHints(field);
      if (!inputEl) return false;

      const currentCtrlText = (inputEl.closest('[class*="-control"]')?.innerText || '').trim();
      if (currentCtrlText.toLowerCase() === targetOptionText.trim().toLowerCase()) {
        return true;
      }

      inputEl.focus();
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
      await sleep(350);

      let options = Array.from(document.querySelectorAll('[id*="-option-"], [role="option"]'));
      let matched = options.find(
        (opt) => opt.innerText.trim().toLowerCase() === targetOptionText.trim().toLowerCase()
      );

      if (!matched || field.searchable) {
        inputEl.focus();
        setNativeValue(inputEl, targetOptionText.trim(), false);
        await sleep(500);

        options = Array.from(document.querySelectorAll('[id*="-option-"], [role="option"]'));
        matched = options.find(
          (opt) => opt.innerText.trim().toLowerCase() === targetOptionText.trim().toLowerCase()
        ) || options.find(
          (opt) => opt.innerText.trim().toLowerCase().includes(targetOptionText.trim().toLowerCase())
        );
      }

      if (matched) {
        matched.click();
        await sleep(250);
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function fillKbkiField(field, cleanKbki) {
    const btn = (field.selector ? document.querySelector(field.selector) : null) ||
      document.querySelector('#form-product-kbki-select');
    if (!btn) return false;

    if (btn.innerText && btn.innerText.includes(cleanKbki)) {
      return true;
    }

    btn.click();
    await sleep(450);

    let matchedOption = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const options = Array.from(document.querySelectorAll('[role="option"], [id*="-option-"]'))
        .filter((opt) => opt.offsetParent !== null && opt.innerText?.includes(cleanKbki));

      if (options.length > 0) {
        matchedOption = options[0];
        break;
      }
      await sleep(300);
    }

    if (!matchedOption) {
      return false;
    }

    matchedOption.scrollIntoView({ block: 'nearest' });

    ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((evtType) => {
      matchedOption.dispatchEvent(new MouseEvent(evtType, {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    });

    await sleep(300);
    return true;
  }

  async function fillBrandPdkiField(appNumber) {
    const sw = document.querySelector('#form-product-brand-isActive-switch');
    if (!sw) return false;

    if (!sw.checked) {
      sw.click();
      await sleep(400);
    }

    const inp = document.querySelector('#form-product-brand-application-number-input');
    if (!inp) return false;

    inp.focus();
    setNativeValue(inp, appNumber, false);
    await sleep(300);

    const checkBtn = document.querySelector('#form-product-check-brand-btn');
    if (checkBtn && !checkBtn.disabled) {
      checkBtn.click();
      await sleep(500);
    }

    return true;
  }

  // Urutkan agar Klasifikasi -> Asal Negara -> Dropdown lain -> Input Teks -> Harga Produk diproses terakhir
  const orderedTargets = [...targets].sort((a, b) => {
    const rank = (f) => {
      if (f.key === 'select_klasifikasi') return 1;
      if (f.key === 'select_asal_negara') return 2;
      if (f.type === 'single-price' || f.key.toLowerCase().includes('price')) return 5;
      return 3;
    };
    return rank(a) - rank(b);
  });

  let filledCount = 0;

  for (const field of orderedTargets) {
    const val = aiData[field.key];
    if (val === undefined || val === null || String(val).trim() === '') continue;

    if (
      field.type === 'react-select-binary' ||
      field.type === 'react-select' ||
      field.type === 'react-select-country'
    ) {
      const success = await selectReactOption(field, String(val));
      if (success) {
        filledCount++;
        if (field.key === 'select_klasifikasi' && String(val).trim().toLowerCase() === 'import') {
          await sleep(600);
        }
      }
    } else if (field.type === 'kbki-input') {
      const okKbki = await fillKbkiField(field, String(val).trim());
      if (okKbki) filledCount++;
    } else if (field.type === 'brand-pdki') {
      const okBrand = await fillBrandPdkiField(String(val).trim());
      if (okBrand) filledCount++;
    } else if (field.type === 'single-price' || field.key.toLowerCase().includes('price')) {
      const priceEl = (field.selector ? document.querySelector(field.selector) : null) ||
        document.querySelector('#form-product-price-input') ||
        document.querySelector('input[name="priceAndVariantField.variants.0.price"]');
      const cleanDigits = String(val).replace(/\D/g, '');
      if (priceEl && cleanDigits) {
        const okPrice = await fillNumericCurrencyInput(priceEl, cleanDigits);
        if (okPrice) filledCount++;
      }
    } else {
      const el = document.querySelector(field.selector);
      if (!el) continue;

      let cleanVal = String(val).trim();
      if (field.key === 'description' && cleanVal.length > 1990) {
        cleanVal = cleanVal.slice(0, 1990);
      }
      if (field.type === 'number-text') {
        cleanVal = cleanVal.replace(/[^\d.]/g, '');
      }
      setNativeValue(el, cleanVal);
      filledCount++;
      await sleep(40);
    }
  }

  // Terapkan tabel varian yang sudah diedit di Step 2 (Master Product > 1 varian)
  let updatedVariantsCount = 0;
  if (Array.isArray(variantRows) && variantRows.length > 0) {
    const trList = Array.from(document.querySelectorAll('#variant-table-container table tbody tr'));
    for (const vRow of variantRows) {
      const tr = trList[vRow.index];
      if (!tr) continue;

      const stockEl = tr.querySelector(`input[name="priceAndVariantField.variants.${vRow.index}.stock"]`) ||
        tr.querySelector('input[name$=".stock"]');
      const priceEl = tr.querySelector(`input[name="priceAndVariantField.variants.${vRow.index}.price"]`) ||
        tr.querySelector('input[name$=".price"]');
      const switchEl = tr.querySelector('input[type="checkbox"]');

      const cleanStock = String(vRow.stock || '').replace(/\D/g, '');
      if (stockEl && cleanStock !== '') {
        stockEl.focus();
        setNativeValue(stockEl, cleanStock, true);
        await sleep(35);
      }

      const cleanPrice = String(vRow.price || '').replace(/\D/g, '');
      if (priceEl && cleanPrice !== '') {
        await fillNumericCurrencyInput(priceEl, cleanPrice);
      }

      if (switchEl && !switchEl.disabled && switchEl.checked !== Boolean(vRow.isActive)) {
        switchEl.click();
        await sleep(50);
      }

      updatedVariantsCount++;
    }
  }

  const variantNote = updatedVariantsCount > 0 ? ` serta memperbarui ${updatedVariantsCount} varian` : '';
  return {
    ok: true,
    msg: `Berhasil mengisi ${filledCount} dari ${orderedTargets.length} kolom target${variantNote}!`
  };
}

// ==========================================
// FUNGSI 4: REFERENCE GRABBER - SCAN HALAMAN KATALOG INAPROC
// ==========================================
async function scrapeInaprocReference() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const url = window.location.href;
  const pathname = window.location.pathname.replace(/\/+$/, '');

  const showMoreBtn = document.querySelector('#pdp-description-show-more-btn') ||
    Array.from(document.querySelectorAll('button')).find(
      (b) => b.offsetParent !== null && b.innerText?.trim().toLowerCase().includes('lihat selengkapnya')
    );

  if (showMoreBtn && showMoreBtn.innerText?.toLowerCase().includes('lihat selengkapnya')) {
    showMoreBtn.click();
    await sleep(350);
  }

  const h1 = document.querySelector('h1');
  const productName = h1 ? h1.innerText.trim() : '';

  if (!productName) {
    return {
      ok: false,
      msg: 'Nama Produk (H1) tidak ditemukan. Pastikan Anda berada di halaman detail produk katalog.inaproc.id.'
    };
  }

  function parseRupiahIgnoreDecimal(rawText) {
    if (!rawText) return 0;
    const withoutDecimal = rawText.split(',')[0];
    const digits = withoutDecimal.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  let rawIncludePrice = 0;
  const mainSection = h1.closest('main') || h1.parentElement?.parentElement?.parentElement || document.body;
  const priceCandidates = Array.from(mainSection.querySelectorAll('p, span, div, h2, h3'))
    .filter((el) => {
      const txt = el.innerText?.trim() || '';
      const style = window.getComputedStyle(el);
      if (style.textDecorationLine.includes('line-through')) return false;
      return /^Rp\s*[\d.,]+$/i.test(txt);
    });

  if (priceCandidates.length > 0) {
    rawIncludePrice = parseRupiahIgnoreDecimal(priceCandidates[0].innerText);
  } else {
    const bodyText = mainSection.innerText || document.body.innerText;
    const priceMatches = bodyText.match(/Rp\s*[\d.,]+/gi) || [];
    for (const pm of priceMatches) {
      const parsed = parseRupiahIgnoreDecimal(pm);
      if (parsed >= 100) {
        rawIncludePrice = parsed;
        break;
      }
    }
  }

  const excludePrice = rawIncludePrice > 0 ? Math.round(rawIncludePrice / 1.11) : 0;

  const specs = {};

  document.querySelectorAll('table tr').forEach((tr) => {
    const cells = tr.querySelectorAll('th, td');
    if (cells.length >= 2) {
      const k = cells[0].innerText.trim().replace(/\s+/g, ' ');
      const v = cells[1].innerText.trim().replace(/\s+/g, ' ');
      if (k && v && k.length < 100 && v.length <= 5000) specs[k] = v;
    }
  });

  document.querySelectorAll('dt').forEach((dt) => {
    const dd = dt.nextElementSibling;
    if (dd && dd.tagName.toLowerCase() === 'dd') {
      const k = dt.innerText.trim().replace(/\s+/g, ' ');
      const v = dd.innerText.trim().replace(/\s+/g, ' ');
      if (k && v && k.length < 100 && v.length <= 5000) specs[k] = v;
    }
  });

  document.querySelectorAll('div, li, p, span').forEach((el) => {
    if (el.children.length === 2) {
      const c1 = el.children[0].innerText?.trim();
      const c2 = el.children[1].innerText?.trim();
      if (
        c1 && c2 &&
        c1.length > 1 && c1.length <= 80 &&
        c2.length > 0 && c2.length <= 5000 &&
        !c1.includes('\n') &&
        !specs[c1]
      ) {
        if (!c1.startsWith('Rp') && !c2.startsWith('Rp')) {
          specs[c1] = c2.replace(/\s+/g, ' ');
        }
      }
    }
  });

  function findSpecByKeywords(keywords) {
    const entries = Object.entries(specs);
    for (const kw of keywords) {
      const found = entries.find(([k]) => k.toLowerCase() === kw.toLowerCase());
      if (found) return found[1];
    }
    for (const kw of keywords) {
      const found = entries.find(([k]) => k.toLowerCase().includes(kw.toLowerCase()));
      if (found) return found[1];
    }
    return '';
  }

  const pdkiLink = document.querySelector('a[href*="pdki-indonesia.dgip.go.id"]');
  const lastSegment = pathname.split('/').pop() || '';
  const hasHexSuffix = /-[0-9a-f]{6,12}$/i.test(lastSegment);

  let isMasterProduct = false;
  let brandValue = '';
  let brandApplicationNumber = '';

  if (pdkiLink) {
    isMasterProduct = false;
    brandValue = pdkiLink.innerText.trim() || findSpecByKeywords(['Merek', 'Merk', 'Brand']);
    try {
      const parsedUrl = new URL(pdkiLink.href);
      brandApplicationNumber = (parsedUrl.searchParams.get('keyword') || '').trim();
    } catch (e) {
      const kwMatch = pdkiLink.href.match(/[?&]keyword=([^&]+)/i);
      if (kwMatch) brandApplicationNumber = decodeURIComponent(kwMatch[1]).trim();
    }
  } else if (hasHexSuffix) {
    isMasterProduct = true;
    brandValue = productName.slice(0, 20).trim();
  } else {
    isMasterProduct = false;
    brandValue = findSpecByKeywords(['Merek', 'Merk', 'Brand']) || productName.slice(0, 20).trim();
  }

  const jenisRaw = findSpecByKeywords(['Jenis Produk', 'Status Produk', 'Asal Produk']);
  const isImport = jenisRaw.toLowerCase().includes('impor');
  const productOrigin = isImport ? 'Import' : 'Lokal';

  const rawCountry = findSpecByKeywords(['Asal Negara', 'Negara Asal', 'Negara Pembuat']);
  const countryOfOrigin = (isImport && rawCountry && rawCountry !== '-') ? rawCountry.trim() : '';

  const rawKbki = findSpecByKeywords(['Kode KBKI', 'KBKI']);
  const kbkiCode = (rawKbki && rawKbki !== '-') ? rawKbki.replace(/\D/g, '') || rawKbki.trim() : '';

  const rawTelecomCert = findSpecByKeywords([
    'Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi',
    'Sertifikat Alat Telekomunikasi'
  ]);
  const trimmedTelecom = (rawTelecomCert || '').trim();
  let telecomCert = '';
  if (trimmedTelecom === '-' || trimmedTelecom.toLowerCase() === 'tidak memiliki') {
    telecomCert = 'Tidak Memiliki';
  } else if (
    /\d+\s*\/\s*SDPPI\s*\/\s*\d{4}/i.test(trimmedTelecom) ||
    trimmedTelecom.toLowerCase().includes('sdppi') ||
    trimmedTelecom.toLowerCase() === 'memiliki' ||
    trimmedTelecom !== ''
  ) {
    telecomCert = 'Memiliki';
  }

  const rawEcoLabel = findSpecByKeywords([
    'Label Produk Ramah Lingkungan Hidup',
    'Ramah Lingkungan Hidup'
  ]);
  const ecoLabel = (rawEcoLabel && rawEcoLabel !== '-') ? rawEcoLabel.trim() : '';

  const rawUnit = findSpecByKeywords(['Satuan Barang', 'Satuan Produk', 'Satuan']);
  const productUnit = (rawUnit && rawUnit !== '-') ? rawUnit.trim() : '';

  let priceStructure = '';
  const rawPriceStruct = findSpecByKeywords(['Struktur Harga']);
  if (rawPriceStruct && rawPriceStruct !== '-') {
    priceStructure = rawPriceStruct.toLowerCase().includes('tidak') ? 'Tidak Tersedia' : 'Tersedia';
  } else {
    const structHeading = Array.from(document.querySelectorAll('h2, h3, h4, button, [role="tab"]')).find(
      (el) => el.innerText && el.innerText.trim().toLowerCase() === 'struktur harga'
    );
    if (structHeading) {
      const containerTxt = (structHeading.parentElement?.innerText || '').toLowerCase();
      priceStructure = containerTxt.includes('tidak tersedia') || containerTxt.includes('tidak ada')
        ? 'Tidak Tersedia'
        : 'Tersedia';
    } else {
      priceStructure = 'Tidak Tersedia';
    }
  }

  let description = '';
  const headings = Array.from(document.querySelectorAll('h2, h3, h4, button, div'));
  const descHeading = headings.find(
    (el) => el.innerText && el.innerText.trim().toLowerCase() === 'deskripsi produk'
  );
  if (descHeading && descHeading.parentElement) {
    const siblingText = descHeading.parentElement.innerText
      .replace(/^Deskripsi Produk\s*/i, '')
      .replace(/Lihat Lebih Sedikit\s*$/i, '')
      .replace(/Lihat Selengkapnya\s*$/i, '')
      .trim();
    if (siblingText.length > 10) {
      description = siblingText.slice(0, 1990);
    }
  }
  if (!description) {
    description = findSpecByKeywords(['Deskripsi Produk', 'Deskripsi']) || productName;
  }

  const productSpec = findSpecByKeywords(['Spesifikasi Produk', 'Spesifikasi']);

  const warranty = findSpecByKeywords(['Garansi', 'Masa Garansi']);
  const kelengkapan = findSpecByKeywords(['Kelengkapan Produk', 'Kelengkapan', 'Isi Paket']);
  const weightRaw = findSpecByKeywords(['Berat per Produk', 'Berat Produk', 'Berat']);
  const dimensionRaw = findSpecByKeywords(['Dimensi per Produk', 'Dimensi Produk', 'Dimensi', 'Ukuran']);

  const weightDisplay = weightRaw ? weightRaw.trim() : '';
  let weightGrams = '';
  if (weightRaw) {
    const beforeDecimal = weightRaw.split(',')[0];
    const digitsOnly = beforeDecimal.replace(/\D/g, '');
    if (digitsOnly) {
      weightGrams = String(parseInt(digitsOnly, 10));
    }
  }

  let lengthCm = '', widthCm = '', heightCm = '';
  if (dimensionRaw) {
    const dims = dimensionRaw.match(/[\d.,]+/g);
    if (dims && dims.length >= 3) {
      lengthCm = dims[0].replace(',', '.');
      widthCm = dims[1].replace(',', '.');
      heightCm = dims[2].replace(',', '.');
    }
  }

  const seenUrls = new Set();
  const imageUrls = [];
  const MAX_PRODUCT_IMAGES = 5;
  const VIDEO_EXT_REGEX = /\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?|$)/i;

  function addUniqueUploadUrl(rawSrc) {
    if (imageUrls.length >= MAX_PRODUCT_IMAGES) return;
    if (!rawSrc || !rawSrc.startsWith('http')) return;
    if (!rawSrc.toLowerCase().includes('/upload/')) return;
    if (VIDEO_EXT_REGEX.test(rawSrc)) return;

    const baseKey = rawSrc.split('?')[0];
    if (!seenUrls.has(baseKey)) {
      seenUrls.add(baseKey);
      imageUrls.push(rawSrc);
    }
  }

  // 1. Ambil langsung dari React Fiber props.items pada .image-gallery (abaikan item .mp4 / video)
  const gallery = document.querySelector('.image-gallery');
  if (gallery) {
    const fiberKey = Object.keys(gallery).find((k) => k.startsWith('__reactFiber'));
    let cur = fiberKey ? gallery[fiberKey] : null;
    for (let d = 0; d < 15 && cur; d++) {
      const items = cur.memoizedProps?.items;
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((item) => {
          const origUrl = item?.original || '';
          if (VIDEO_EXT_REGEX.test(origUrl)) return;
          addUniqueUploadUrl(origUrl || item?.thumbnail || '');
        });
        break;
      }
      cur = cur.return;
    }
  }

  // 2. Fallback dari thumbnail galeri (abaikan thumbnail yang memiliki ikon play <svg>)
  if (imageUrls.length === 0) {
    document.querySelectorAll('.image-gallery-thumbnail').forEach((thumbEl) => {
      if (thumbEl.querySelector('svg, video, iframe')) return;
      const img = thumbEl.querySelector('img');
      if (img) addUniqueUploadUrl(img.currentSrc || img.src || '');
    });
  }

  // 3. Fallback dari slide galeri (.image-gallery-slide img)
  if (imageUrls.length === 0) {
    document.querySelectorAll('.image-gallery-slide img').forEach((img) => {
      addUniqueUploadUrl(img.currentSrc || img.src || '');
    });
  }

  // 4. Fallback umum jika struktur galeri berbeda
  if (imageUrls.length === 0) {
    const normalizedProductName = productName.toLowerCase().trim();
    Array.from(document.querySelectorAll('img')).forEach((img) => {
      if (img.closest('header, nav, footer')) return;
      const lowerAlt = (img.alt || '').toLowerCase().trim();
      if (!lowerAlt || lowerAlt.includes('empty-store') || lowerAlt.includes('store-image')) return;

      const isMatchingProductAlt =
        lowerAlt === normalizedProductName ||
        lowerAlt.includes(normalizedProductName) ||
        normalizedProductName.includes(lowerAlt);

      if (isMatchingProductAlt) {
        addUniqueUploadUrl(img.currentSrc || img.src || '');
      }
    });
  }

  return {
    ok: true,
    reference: {
      sourceUrl: url,
      productName,
      includePrice: rawIncludePrice,
      excludePrice,
      isMasterProduct,
      productTypeLabel: isMasterProduct ? 'Master Product' : 'Non-Master Product',
      brandValue,
      brandApplicationNumber,
      productOrigin,
      countryOfOrigin,
      kbkiCode,
      telecomCert,
      ecoLabel,
      productUnit,
      priceStructure,
      description,
      productSpec,
      warranty,
      kelengkapan,
      weightDisplay,
      weightGrams,
      lengthCm,
      widthCm,
      heightCm,
      imageUrls,
      specs
    }
  };
}

// ==========================================
// FUNGSI 5: SCAN SEMUA KOLOM FORM ADD PRODUCT + TABEL VARIAN MASTER (1 ATAU 2+ TIPE VARIAN)
// ==========================================
function scanAddFormAllFields() {
  const fields = [];
  const pageText = document.body.innerText || '';

  const hasMasterBadgeText = pageText.toLowerCase().includes('master produk pengelola pusat');
  const hasMasterDropdown = Array.from(document.querySelectorAll('[class*="-control"]'))
    .some((el) => el.offsetParent !== null && (el.innerText || '').toLowerCase().includes('cari master produk'));

  let isVariantLocked = false;
  const variantContainer = document.querySelector('#variant-table-container') ||
    Array.from(document.querySelectorAll('h2, h3, h4, div')).find(
      (el) => el.innerText && el.innerText.trim().toLowerCase() === 'varian'
    )?.parentElement;

  if (variantContainer) {
    const lockIcon = variantContainer.querySelector('svg[data-icon*="lock"], [class*="lock"], [aria-label*="lock" i]');
    if (lockIcon) {
      isVariantLocked = true;
    }
  }

  const isFormMasterProduct = hasMasterBadgeText || hasMasterDropdown || isVariantLocked;

  function extractCleanLabelText(lblEl) {
    if (!lblEl) return '';
    const firstSpan = lblEl.querySelector(':scope > span');
    const raw = (firstSpan ? firstSpan.innerText : lblEl.innerText) || '';
    return raw.trim().replace(/\n+/g, ' ').replace(/\s*\*\s*$/, '').replace(/\s*Wajib\s*$/i, '').trim();
  }

  function findFieldLabelElement(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl;
    }
    if (el.name) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.name)}"]`);
      if (lbl) return lbl;
    }
    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const lbl = parent.querySelector('label');
      if (lbl) return lbl;
      parent = parent.parentElement;
    }
    return null;
  }

  function getContextLabel(el) {
    const lbl = findFieldLabelElement(el);
    return extractCleanLabelText(lbl);
  }

  function checkIsMainInfoRequired(el) {
    const isMainName = Boolean(el.name && el.name.startsWith('productInformations.mainInformations.'));
    let inMainSection = isMainName;
    let p = el.parentElement;
    for (let i = 0; i < 10 && p; i++) {
      const heading = p.querySelector('h1, h2, h3, h4');
      if (heading && heading.innerText?.trim().toLowerCase() === 'informasi utama') {
        inMainSection = true;
        break;
      }
      p = p.parentElement;
    }
    if (!inMainSection) return false;

    const lblEl = findFieldLabelElement(el);
    const lblRaw = (lblEl?.innerText || '').toLowerCase();
    const wrapperRaw = (lblEl?.parentElement?.innerText || el.parentElement?.parentElement?.innerText || '').toLowerCase();
    return lblRaw.includes('wajib') || lblRaw.includes('*') || wrapperRaw.includes('wajib');
  }

  const allInputs = Array.from(document.querySelectorAll('input'));
  const catInput = allInputs.find(i => i.placeholder && i.placeholder.includes('Pilih Kategori'));
  const category = catInput ? catInput.value : '';

  const nameEl = document.querySelector('input[name="name"]');
  if (nameEl) {
    fields.push({ key: 'name', label: 'Nama Produk', type: 'text', selector: 'input[name="name"]' });
  }

  const descEl = document.querySelector('textarea[name="description"]');
  if (descEl) {
    fields.push({ key: 'description', label: 'Deskripsi Produk', type: 'textarea', selector: 'textarea[name="description"]' });
  }

  const brandSwitch = document.querySelector('#form-product-brand-isActive-switch');
  if (brandSwitch && !brandSwitch.disabled) {
    fields.push({
      key: 'brand_application_number',
      label: 'Merek (No. Permohonan PDKI)',
      type: 'brand-pdki',
      selector: '#form-product-brand-isActive-switch'
    });
  }

  let hasKlasifikasiDropdown = false;
  let hasAsalNegaraDropdown = false;

  Array.from(document.querySelectorAll('input[id^="react-select-"]')).forEach((el) => {
    if (el.id.includes('ppnPercentage') || el.disabled) return;
    if (el.closest('#variant-table-container, table')) return;

    const ctrlText = (el.closest('[class*="-control"]')?.innerText || '').replace(/\n+/g, ' ').trim();
    const ctrlLow = ctrlText.toLowerCase();

    if (ctrlLow.includes('cari master produk')) return;

    if (ctrlLow === 'lokal' || ctrlLow === 'import' || ctrlLow.includes('klasifikasi')) {
      hasKlasifikasiDropdown = true;
      fields.push({
        key: 'select_klasifikasi',
        label: 'Klasifikasi Produk',
        type: 'react-select',
        selector: `#${CSS.escape(el.id)}`,
        controlHints: ['lokal', 'import']
      });
    } else if (ctrlText === '' || ctrlLow.includes('negara') || ctrlLow.includes('country')) {
      hasAsalNegaraDropdown = true;
      fields.push({
        key: 'select_asal_negara',
        label: 'Asal Negara',
        type: 'react-select-country',
        searchable: true,
        selector: `#${CSS.escape(el.id)}`,
        controlHints: ['negara', 'country']
      });
    } else if (ctrlLow.includes('sertifikat alat telekomunikasi')) {
      fields.push({
        key: 'select_sertifikat_telekomunikasi',
        label: 'Sertifikat Alat Telekomunikasi',
        type: 'react-select',
        selector: `#${CSS.escape(el.id)}`,
        controlHints: ['sertifikat alat telekomunikasi']
      });
    } else if (ctrlLow.includes('struktur harga') || ctrlLow === 'tersedia' || ctrlLow === 'tidak tersedia') {
      fields.push({
        key: 'select_struktur_harga',
        label: 'Struktur Harga',
        type: 'react-select',
        selector: `#${CSS.escape(el.id)}`,
        controlHints: ['struktur harga', 'tersedia', 'tidak tersedia']
      });
    } else if (ctrlLow.includes('ramah lingkungan')) {
      fields.push({
        key: 'select_ramah_lingkungan',
        label: 'Label Produk Ramah Lingkungan Hidup',
        type: 'react-select',
        selector: `#${CSS.escape(el.id)}`,
        controlHints: ['ramah lingkungan']
      });
    } else if (ctrlLow.includes('satuan produk') || ctrlLow === 'unit' || ctrlLow === 'pcs' || ctrlLow === 'paket') {
      fields.push({
        key: 'select_satuan_produk',
        label: 'Satuan Produk',
        type: 'react-select',
        searchable: true,
        selector: `#${CSS.escape(el.id)}`,
        controlHints: ['satuan produk', 'unit', 'pcs', 'paket', 'set', 'buah']
      });
    }
  });

  if (hasKlasifikasiDropdown && !hasAsalNegaraDropdown) {
    fields.push({
      key: 'select_asal_negara',
      label: 'Asal Negara',
      type: 'react-select-country',
      searchable: true,
      selector: null,
      controlHints: ['negara', 'country']
    });
  }

  const kbkiBtn = document.querySelector('#form-product-kbki-select');
  if (kbkiBtn) {
    fields.push({
      key: 'kbki_code',
      label: 'Kode KBKI',
      type: 'kbki-input',
      selector: '#form-product-kbki-select'
    });
  }

  // Petakan input teks/angka standar (termasuk kolom Harga Produk tunggal #form-product-price-input)
  Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"])')).forEach((el) => {
    if (el.id && el.id.startsWith('react-select-')) return;
    if (el.closest('#variant-table-container, table')) return;
    if (el.name === 'name' || el.name === 'videoUrl' || el.name === 'brand.input') return;
    if (el.id === 'form-product-brand-application-number-input') return;
    if (el.placeholder && el.placeholder.includes('Pilih Kategori')) return;
    if (el.name && el.name.includes('minPurchase')) return;
    if (el.name && el.name.includes('stock')) return;
    if (el.name && el.name.toLowerCase().includes('sku')) return;

    const phLowCheck = (el.placeholder || '').toLowerCase().trim();
    if (!el.name && !el.id && ['sku', 'harga', 'stok', 'stock'].includes(phLowCheck)) return;

    const isSinglePriceInput =
      el.id === 'form-product-price-input' ||
      (el.name === 'priceAndVariantField.variants.0.price' && phLowCheck === 'masukkan harga');

    if (!isSinglePriceInput && el.name && el.name.includes('priceAndVariantField.variants')) return;

    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || el.disabled) return;

    let lbl = getContextLabel(el) || el.placeholder?.replace('Masukkan ', '') || el.name || el.id;
    const lblLow = (lbl || '').toLowerCase();
    const phLow = (el.placeholder || '').toLowerCase();
    const nameLow = (el.name || '').toLowerCase();

    if (lblLow.includes('kbki') || phLow.includes('kbki') || nameLow.includes('kbki')) {
      return;
    }

    const fieldKey = el.name || el.id;
    let fieldType = 'text';
    if (isSinglePriceInput) {
      fieldType = 'single-price';
      lbl = 'Harga Produk';
    } else if (el.name && el.name.startsWith('shipping.')) {
      fieldType = 'number-text';
    }

    if (el.name === 'shipping.weight') {
      lbl = 'Berat Produk (gr)';
    } else if (el.name === 'shipping.length') {
      lbl = 'Dimensi (Panjang)';
    } else if (el.name === 'shipping.width') {
      lbl = 'Dimensi (Lebar)';
    } else if (el.name === 'shipping.height') {
      lbl = 'Dimensi (Tinggi)';
    }

    const selector = el.id
      ? `#${CSS.escape(el.id)}`
      : (el.name ? `input[name="${el.name}"]` : (el.placeholder ? `input[placeholder="${el.placeholder}"]` : null));

    if (selector && lbl) {
      fields.push({
        key: fieldKey,
        label: lbl,
        type: fieldType,
        selector,
        isMainInfoRequired: checkIsMainInfoRequired(el)
      });
    }
  });

  // Grab Tabel Varian (mendukung 1 tipe varian maupun 2+ tipe varian sekaligus)
  let variantHeaderName = 'Varian';
  const variantRows = [];
  const variantTable = document.querySelector('#variant-table-container table');

  if (variantTable) {
    const thList = Array.from(variantTable.querySelectorAll('thead th, thead td'))
      .map((th) => th.innerText.trim().replace(/\s+/g, ' '));

    const stokHeaderIdx = thList.findIndex((h) => h.toLowerCase() === 'stok');
    const variantAttrCount = stokHeaderIdx > 0 ? stokHeaderIdx : 1;

    const attrHeaders = thList.slice(0, variantAttrCount).filter(Boolean);
    if (attrHeaders.length > 0) {
      variantHeaderName = attrHeaders.join(' / ');
    }

    const tbodyTrs = Array.from(variantTable.querySelectorAll('tbody tr'));
    const activeRowSpans = new Array(variantAttrCount).fill(null);

    tbodyTrs.forEach((tr, idx) => {
      const cells = Array.from(tr.children);
      const variantValues = [];
      let domCellCursor = 0;

      for (let col = 0; col < variantAttrCount; col++) {
        if (activeRowSpans[col] && activeRowSpans[col].remaining > 0) {
          variantValues.push(activeRowSpans[col].text);
          activeRowSpans[col].remaining -= 1;
        } else {
          const td = cells[domCellCursor++];
          const cellText = td ? td.innerText.trim().replace(/\s+/g, ' ') : '';
          variantValues.push(cellText);

          if (td && td.rowSpan > 1) {
            activeRowSpans[col] = { text: cellText, remaining: td.rowSpan - 1 };
          }
        }
      }

      const cleanValues = variantValues.filter(Boolean);
      const finalValues = cleanValues.length > 0 ? cleanValues : [`Varian ${idx + 1}`];
      const variantName = finalValues.join(' - ');

      const stockEl = tr.querySelector('input[name$=".stock"]');
      const priceEl = tr.querySelector('input[name$=".price"]');
      const switchEl = tr.querySelector('input[type="checkbox"]');

      const priceTdText = priceEl?.closest('td')?.innerText || '';
      const hintMatch = priceTdText.match(/Rentang harga wajar\s*:[^\n]+/i);
      const priceHint = hintMatch ? hintMatch[0].trim() : '';

      variantRows.push({
        index: idx,
        name: variantName,
        variantValues: finalValues,
        stock: stockEl ? stockEl.value : '',
        price: priceEl ? priceEl.value : '',
        isActive: switchEl ? Boolean(switchEl.checked) : true,
        priceHint
      });
    });
  }

  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));

  return {
    ok: true,
    category,
    isFormMasterProduct,
    fields,
    variantHeaderName,
    variantRows,
    hasImageUpload: fileInputs.length > 0
  };
}

// ==========================================
// FUNGSI 6: INJECT SEMUA GAMBAR KE <input type="file">
// ==========================================
async function injectProductImageFiles(filesPayload) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
  if (fileInputs.length === 0) {
    return { ok: false, msg: 'Kolom Upload Foto Produk (<input type="file">) tidak ditemukan.' };
  }

  const fileObjects = filesPayload.map((item, index) => {
    const byteCharacters = atob(item.base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: item.mimeType || 'image/jpeg' });
    return new File([blob], item.fileName || `produk-ref-${index + 1}.jpg`, {
      type: item.mimeType || 'image/jpeg'
    });
  });

  const firstInput = fileInputs[0];

  if (firstInput.multiple || fileInputs.length === 1) {
    const dt = new DataTransfer();
    fileObjects.forEach((f) => dt.items.add(f));
    firstInput.files = dt.files;
    firstInput.dispatchEvent(new Event('change', { bubbles: true }));
    firstInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    for (let i = 0; i < fileObjects.length && i < fileInputs.length; i++) {
      const dt = new DataTransfer();
      dt.items.add(fileObjects[i]);
      fileInputs[i].files = dt.files;
      fileInputs[i].dispatchEvent(new Event('change', { bubbles: true }));
      fileInputs[i].dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
    }
  }

  return { ok: true, msg: `${fileObjects.length} foto produk berhasil diunggah!` };
}

// ==========================================
// EKSEKUTOR SCRIPT KE TAB AKTIF
// ==========================================
async function executeFuncOnActiveTab(targetFunc, args = []) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    return { ok: false, msg: 'Tab aktif tidak ditemukan' };
  }

  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: targetFunc,
      args: args
    });
    return (res && res.result) ? res.result : { ok: false, msg: 'Tidak ada hasil dari halaman' };
  } catch (e) {
    return { ok: false, msg: `Error: ${e.message || String(e)}` };
  }
}

async function handleUploadReferenceImages(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { ok: false, msg: 'Tidak ada URL gambar referensi.' };
  }

  const filesPayload = [];
  for (let idx = 0; idx < imageUrls.length; idx++) {
    try {
      const response = await fetch(imageUrls[idx]);
      if (!response.ok) continue;
      const blob = await response.blob();
      const mimeType = blob.type || 'image/jpeg';
      const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      filesPayload.push({
        base64Data: btoa(binary),
        mimeType,
        fileName: `inaproc-ref-${idx + 1}.${ext}`
      });
    } catch (e) {}
  }

  if (filesPayload.length === 0) {
    return { ok: false, msg: 'Gagal mengunduh gambar dari server referensi.' };
  }

  return await executeFuncOnActiveTab(injectProductImageFiles, [filesPayload]);
}

// ==========================================
// HANDLER API PROVIDER (GEMINI & 9ROUTER) - EXISTING
// ==========================================
async function fetchWithTimeout(url, options, timeoutMs = 45000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error('Timeout: Server AI tidak merespons dalam batas waktu (45 detik).');
    }
    if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
      throw new Error('Connection refused: Tidak dapat terhubung ke server 9Router. Pastikan 9Router berjalan di port yang benar.');
    }
    throw err;
  }
}

function normalizeBaseUrl(rawUrl) {
  return (rawUrl || 'http://localhost:20128/v1').trim().replace(/\/+$/, '');
}

function formatHttpError(status, errBody, providerName) {
  const detail = errBody?.error?.message || errBody?.message || '';
  if (status === 401 || status === 403) {
    return `401 Unauthorized: API Key ${providerName} tidak valid atau ditolak.`;
  }
  if (status === 404) {
    return `404 Not Found: Endpoint atau model tidak ditemukan pada ${providerName}. ${detail}`;
  }
  if (status === 429) {
    return `429 Rate Limit: Batas permintaan ${providerName} tercapai. ${detail}`;
  }
  if (status === 503 || status === 502) {
    return `${status} Server Sibuk: ${providerName} sedang padat. ${detail}`;
  }
  return `HTTP ${status}: ${detail || 'Terjadi kesalahan pada server AI.'}`;
}

async function handleFetch9RouterModels({ baseUrl, apiKey }) {
  const cleanBase = normalizeBaseUrl(baseUrl);
  if (!apiKey) return { ok: false, msg: 'Masukkan API Key 9Router terlebih dahulu.' };

  try {
    const response = await fetchWithTimeout(
      `${cleanBase}/models`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      },
      15000
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return { ok: false, msg: formatHttpError(response.status, errJson, '9Router') };
    }

    const json = await response.json();
    const list = Array.isArray(json?.data) ? json.data : [];
    const modelIds = list.map((item) => item && item.id).filter((id) => typeof id === 'string' && id.trim() !== '');

    if (modelIds.length === 0) {
      return { ok: false, msg: 'Koneksi berhasil, namun daftar model (data[].id) kosong di 9Router.' };
    }
    return { ok: true, models: modelIds };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
}

async function handleTest9RouterConnection({ baseUrl, apiKey, model }) {
  const modelsRes = await handleFetch9RouterModels({ baseUrl, apiKey });
  if (!modelsRes.ok) return modelsRes;

  if (model && !modelsRes.models.includes(model)) {
    return {
      ok: false,
      msg: `Terhubung ke 9Router (${modelsRes.models.length} model), namun model terpilih "${model}" tidak tersedia.`
    };
  }
  return {
    ok: true,
    models: modelsRes.models,
    msg: `Koneksi berhasil! Ditemukan ${modelsRes.models.length} model aktif di 9Router.`
  };
}

async function handleGenerateAiSpec(payload) {
  const {
    provider,
    geminiApiKey,
    routerBaseUrl,
    routerApiKey,
    routerModel,
    systemInstruction,
    userPrompt,
    responseSchema
  } = payload;

  if (provider === 'gemini') {
    if (!geminiApiKey) return { ok: false, msg: 'Masukkan & simpan Gemini API Key terlebih dahulu.' };
    const modelName = 'gemini-3.8-flash';
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: responseSchema
              }
            })
          },
          45000
        );

        if (response.status === 429) {
          const errJson = await response.json().catch(() => ({}));
          const rawMsg = errJson.error?.message || 'Rate limit exceeded';
          const isDailyQuota = rawMsg.toLowerCase().includes('per day') || rawMsg.toLowerCase().includes('daily');
          return {
            ok: false,
            isRateLimit: true,
            lockSeconds: isDailyQuota ? 300 : 60,
            msg: isDailyQuota
              ? 'Kuota harian API Gemini habis. Ganti API Key atau tunggu besok.'
              : 'Batas permintaan per menit (Rate Limit) tercapai.'
          };
        }

        if (response.status === 503) {
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          return { ok: false, msg: 'Server Gemini sedang padat, silakan coba sesaat lagi.' };
        }

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          return { ok: false, msg: formatHttpError(response.status, errJson, 'Gemini') };
        }

        const result = await response.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) return { ok: false, msg: 'Respons AI Gemini kosong.' };
        return { ok: true, rawText };
      } catch (err) {
        if (attempt < maxRetries && (err.message.includes('high demand') || err.message.includes('503'))) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return { ok: false, msg: err.message };
      }
    }
  }

  if (provider === '9router') {
    const cleanBase = normalizeBaseUrl(routerBaseUrl);
    if (!routerApiKey) return { ok: false, msg: 'Masukkan & simpan API Key 9Router terlebih dahulu.' };
    if (!routerModel) return { ok: false, msg: 'Pilih model 9Router terlebih dahulu (klik Refresh Model).' };

    const jsonSchemaHint = `\n\nPENTING: Kembalikan jawaban HANYA berupa objek JSON valid tanpa teks pembuka/penutup atau markdown codeblock, dengan properti wajib berikut:\n${JSON.stringify(responseSchema.properties, null, 2)}`;

    try {
      const response = await fetchWithTimeout(
        `${cleanBase}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${routerApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: routerModel,
            messages: [
              { role: 'system', content: systemInstruction + jsonSchemaHint },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 2048
          })
        },
        45000
      );

      if (response.status === 429) {
        const errJson = await response.json().catch(() => ({}));
        return { ok: false, isRateLimit: true, lockSeconds: 60, msg: formatHttpError(429, errJson, '9Router') };
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return { ok: false, msg: formatHttpError(response.status, errJson, '9Router') };
      }

      const result = await response.json();
      const rawText = result.choices?.[0]?.message?.content;
      if (!rawText || !rawText.trim()) return { ok: false, msg: 'Respons AI dari 9Router kosong.' };
      return { ok: true, rawText };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  return { ok: false, msg: 'Provider AI tidak dikenali.' };
}

// ==========================================
// MESSAGE LISTENER & COMMANDS
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'RUN_VARIAN_TOGGLE') {
    executeFuncOnActiveTab(runVarianToggle).then(sendResponse);
    return true;
  }
  if (request.action === 'SCAN_TARGET_FIELDS') {
    executeFuncOnActiveTab(scanTargetFields).then(sendResponse);
    return true;
  }
  if (request.action === 'FILL_FORM_FIELDS') {
    executeFuncOnActiveTab(fillFormFields, [request.payload]).then(sendResponse);
    return true;
  }
  if (request.action === 'SCRAPE_INAPROC_REF') {
    executeFuncOnActiveTab(scrapeInaprocReference).then(sendResponse);
    return true;
  }
  if (request.action === 'SCAN_ADD_FORM_ALL') {
    executeFuncOnActiveTab(scanAddFormAllFields).then(sendResponse);
    return true;
  }
  if (request.action === 'UPLOAD_REF_IMAGES') {
    handleUploadReferenceImages(request.imageUrls).then(sendResponse);
    return true;
  }
  if (request.action === 'FETCH_9ROUTER_MODELS') {
    handleFetch9RouterModels(request.payload).then(sendResponse);
    return true;
  }
  if (request.action === 'TEST_9ROUTER_CONNECTION') {
    handleTest9RouterConnection(request.payload).then(sendResponse);
    return true;
  }
  if (request.action === 'GENERATE_AI_SPEC') {
    handleGenerateAiSpec(request.payload).then(sendResponse);
    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-varian') {
    const result = await executeFuncOnActiveTab(runVarianToggle);
    chrome.runtime.sendMessage({ action: 'VARIAN_RESULT_FROM_SHORTCUT', result }).catch(() => {});
  }
});