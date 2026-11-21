(() => {
  const KEYS = {
    progress: "dk-progress",
    documents: "dk-documents",
    changes: "dk-changes",
    photos: "dk-photos"
  };
  const DEFAULT_PROGRESS = {
    overall: 48,
    stage: 68,
    title: "Строительно-монтажные работы",
    description: "Работы на объекте выполняет ООО «СМУ-90». Здесь публикуются подтверждённый статус текущего этапа и подробные отчёты с площадки.",
    date: "2026-11-18"
  };
  const objectUrls = [];
  let databasePromise;
  let customDocuments = readList(KEYS.documents);
  let customChanges = readList(KEYS.changes);
  let customPhotos = readList(KEYS.photos);

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function readProgress() {
    try {
      return { ...DEFAULT_PROGRESS, ...JSON.parse(localStorage.getItem(KEYS.progress) || "{}") };
    } catch {
      return { ...DEFAULT_PROGRESS };
    }
  }

  function writeValue(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function makeId(prefix) {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${random}`;
  }

  function clampPercent(value) {
    return Math.min(100, Math.max(0, Number(value) || 0));
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
  }

  function formatDate(value, withYear = false) {
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "—";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return withYear ? `${day}.${month}.${date.getFullYear()}` : `${day}.${month}`;
  }

  function plural(number, one, few, many) {
    const mod100 = Math.abs(number) % 100;
    const mod10 = mod100 % 10;
    if (mod100 > 10 && mod100 < 20) return many;
    if (mod10 > 1 && mod10 < 5) return few;
    if (mod10 === 1) return one;
    return many;
  }

  function notify(message) {
    if (typeof window.showToast === "function") window.showToast(message);
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB недоступна"));
        return;
      }
      const request = indexedDB.open("dk-content-files", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("files")) {
          request.result.createObjectStore("files", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  }

  async function fileRequest(mode, action) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("files", mode);
      const request = action(transaction.objectStore("files"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeFile(id, file) {
    return fileRequest("readwrite", store => store.put({ id, blob: file }));
  }

  async function getStoredFile(id) {
    return fileRequest("readonly", store => store.get(id));
  }

  async function removeStoredFile(id) {
    return fileRequest("readwrite", store => store.delete(id));
  }

  function objectUrlFor(record) {
    if (!record?.blob) return "";
    const url = URL.createObjectURL(record.blob);
    objectUrls.push(url);
    return url;
  }

  function downloadBlob(blob, filename) {
    const url = objectUrlFor({ blob });
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function hydrateStoredImages(scope = document) {
    const images = [...scope.querySelectorAll("img[data-stored-image]")];
    await Promise.all(images.map(async image => {
      const id = image.dataset.storedImage;
      if (image.dataset.loaded === id) return;
      try {
        const record = await getStoredFile(id);
        const url = objectUrlFor(record);
        if (url && image.isConnected) {
          image.src = url;
          image.dataset.loaded = id;
        }
      } catch {
        if (image.isConnected) image.closest(".admin-photo-item")?.classList.add("image-unavailable");
      }
    }));
  }

  function applyProgress() {
    const progress = readProgress();
    const overall = clampPercent(progress.overall);
    const stage = clampPercent(progress.stage);
    const ring = document.querySelector(".progress-ring");
    if (ring) {
      ring.style.setProperty("--progress", overall);
      ring.querySelector("strong").innerHTML = `${overall}<span>%</span>`;
    }
    const stageInfo = document.querySelector(".stage-info");
    if (stageInfo) {
      stageInfo.querySelector("h3").textContent = progress.title || DEFAULT_PROGRESS.title;
      stageInfo.querySelector(":scope > p").textContent = progress.description || DEFAULT_PROGRESS.description;
      stageInfo.querySelector(".stage-progress-label strong").textContent = `${stage}%`;
      stageInfo.querySelector(".progress-bar span").style.width = `${stage}%`;
      stageInfo.querySelector(".update-time").innerHTML = `<i></i>Обновлено ${formatDate(progress.date, true)}`;
    }
    const currentStage = document.querySelector(".stage-item.current");
    if (currentStage) {
      currentStage.querySelector("strong").textContent = progress.title || DEFAULT_PROGRESS.title;
      currentStage.querySelector(".stage-percent").textContent = `${stage}%`;
    }
  }

  function renderCustomDocuments() {
    const container = document.querySelector(".project-documents");
    if (!container) return;
    container.querySelectorAll("[data-custom-document]").forEach(item => item.remove());
    const titleRow = container.querySelector(".card-title-row");
    const count = 3 + customDocuments.length;
    titleRow.querySelector(":scope > span").textContent = `${count} ${plural(count, "файл", "файла", "файлов")}`;

    for (const documentData of customDocuments) {
      const button = document.createElement("button");
      button.className = "document-row custom-document-row";
      button.type = "button";
      button.dataset.customDocument = documentData.id;
      button.innerHTML = `<span class="doc-icon"><svg><use href="#icon-doc"></use></svg></span><span><strong>${escapeHTML(documentData.title || documentData.fileName)}</strong><small>${escapeHTML(documentData.fileName)} · ${formatSize(documentData.size)} · добавлен ${formatDate(documentData.createdAt)}</small></span><svg class="doc-download"><use href="#icon-download"></use></svg>`;
      button.addEventListener("click", async () => {
        try {
          const record = await getStoredFile(documentData.id);
          if (!record?.blob) {
            notify("Файл не найден в хранилище браузера. Загрузите его снова через редактор.");
            return;
          }
          downloadBlob(record.blob, documentData.fileName);
          notify(`Документ «${documentData.title || documentData.fileName}» скачан.`);
        } catch {
          notify("Не удалось открыть файл из хранилища браузера.");
        }
      });
      titleRow.after(button);
    }
  }

  function renderCustomChanges() {
    const list = document.querySelector(".changes-list");
    if (!list) return;
    list.querySelectorAll("[data-custom-change]").forEach(item => item.remove());
    const countBadge = document.querySelector(".changes-title .count-badge");
    if (countBadge) countBadge.textContent = String(4 + customChanges.length);

    for (const change of customChanges) {
      const accepted = change.status === "accepted";
      const button = document.createElement("button");
      button.className = "change-item custom-change-item";
      button.type = "button";
      button.dataset.status = accepted ? "accepted" : "pending";
      button.dataset.customChange = change.id;
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = `<span class="change-date">${formatDate(change.date)}</span><span class="change-content"><span class="tag ${accepted ? "tag-green" : "tag-orange"}">${accepted ? "Принято" : "Согласование"}</span><strong>${escapeHTML(change.title)}</strong><small>${escapeHTML(change.summary)}</small><span class="change-details">${escapeHTML(change.details || change.summary)}</span></span><svg class="change-chevron"><use href="#icon-chevron"></use></svg>`;
      list.prepend(button);
    }
  }

  function renderPublicPhotos() {
    const gallery = document.querySelector(".gallery-grid");
    if (!gallery) return;
    if (!gallery.dataset.defaultContent) gallery.dataset.defaultContent = gallery.innerHTML;
    const newestFirst = [...customPhotos].reverse();
    gallery.innerHTML = newestFirst.map((photo, index) => `<img data-stored-image="${escapeHTML(photo.id)}" alt="${escapeHTML(photo.name || `Загруженное фото ${index + 1}`)}">`).join("") + gallery.dataset.defaultContent;
    const count = 3 + customPhotos.length;
    const galleryButton = document.querySelector(".photo-button");
    if (galleryButton) galleryButton.innerHTML = `Смотреть ${count} ${plural(count, "фото", "фото", "фото")}<svg><use href="#icon-arrow-up"></use></svg>`;
    hydrateStoredImages(gallery);

    const cover = document.querySelector(".stage-photo > img");
    if (cover && newestFirst[0]) {
      cover.dataset.storedImage = newestFirst[0].id;
      delete cover.dataset.loaded;
      hydrateStoredImages(document.querySelector(".stage-photo"));
      const dateLabel = document.querySelector(".photo-date");
      if (dateLabel) dateLabel.innerHTML = `<svg><use href="#icon-camera"></use></svg>Обновлено ${formatDate(newestFirst[0].createdAt, true)}`;
    }
  }

  function renderAdminDocuments() {
    const list = document.querySelector("#admin-document-list");
    if (!list) return;
    document.querySelector("#admin-doc-count").textContent = String(customDocuments.length);
    if (!customDocuments.length) {
      list.innerHTML = '<p class="admin-empty">Пока нет загруженных документов.</p>';
      return;
    }
    list.innerHTML = "";
    for (const documentData of [...customDocuments].reverse()) {
      const row = document.createElement("div");
      row.className = "admin-file-row";
      row.innerHTML = `<svg><use href="#icon-doc"></use></svg><span><strong>${escapeHTML(documentData.title || documentData.fileName)}</strong><small>${escapeHTML(documentData.fileName)} · ${formatSize(documentData.size)}</small></span><button class="admin-delete-button" type="button" aria-label="Удалить ${escapeHTML(documentData.fileName)}"><svg><use href="#icon-trash"></use></svg></button>`;
      row.querySelector("button").addEventListener("click", async () => {
        customDocuments = customDocuments.filter(item => item.id !== documentData.id);
        writeValue(KEYS.documents, customDocuments);
        renderAdminDocuments();
        try { await removeStoredFile(documentData.id); } catch {}
        notify("Документ удалён из локальной библиотеки.");
      });
      list.appendChild(row);
    }
  }

  function renderAdminChanges() {
    const list = document.querySelector("#admin-change-list");
    if (!list) return;
    document.querySelector("#admin-change-count").textContent = String(customChanges.length);
    if (!customChanges.length) {
      list.innerHTML = '<p class="admin-empty">Новые изменения появятся здесь и на странице проекта.</p>';
      return;
    }
    list.innerHTML = "";
    for (const change of [...customChanges].reverse()) {
      const accepted = change.status === "accepted";
      const row = document.createElement("div");
      row.className = "admin-change-row";
      row.innerHTML = `<span><span class="tag ${accepted ? "tag-green" : "tag-orange"}">${accepted ? "Принято" : "Согласование"}</span><strong>${escapeHTML(change.title)}</strong><small>${formatDate(change.date, true)} · ${escapeHTML(change.summary)}</small></span><button class="admin-delete-button" type="button" aria-label="Удалить изменение"><svg><use href="#icon-trash"></use></svg></button>`;
      row.querySelector("button").addEventListener("click", () => {
        customChanges = customChanges.filter(item => item.id !== change.id);
        writeValue(KEYS.changes, customChanges);
        renderAdminChanges();
        notify("Изменение удалено.");
      });
      list.appendChild(row);
    }
  }

  function renderAdminPhotos() {
    const grid = document.querySelector("#admin-photo-grid");
    if (!grid) return;
    if (!customPhotos.length) {
      grid.innerHTML = '<p class="admin-empty">Пока нет загруженных фотографий.</p>';
      return;
    }
    grid.innerHTML = "";
    for (const photo of [...customPhotos].reverse()) {
      const item = document.createElement("div");
      item.className = "admin-photo-item";
      item.innerHTML = `<img data-stored-image="${escapeHTML(photo.id)}" alt="${escapeHTML(photo.name)}"><span>${escapeHTML(photo.name)}</span><button class="admin-delete-button" type="button" aria-label="Удалить фотографию"><svg><use href="#icon-trash"></use></svg></button>`;
      item.querySelector("button").addEventListener("click", async () => {
        customPhotos = customPhotos.filter(photoData => photoData.id !== photo.id);
        writeValue(KEYS.photos, customPhotos);
        renderAdminPhotos();
        try { await removeStoredFile(photo.id); } catch {}
        notify("Фотография удалена.");
      });
      grid.appendChild(item);
    }
    hydrateStoredImages(grid);
  }

  function fillProgressForm() {
    const form = document.querySelector("#admin-progress-form");
    if (!form) return;
    const progress = readProgress();
    form.querySelector("#overall-progress").value = clampPercent(progress.overall);
    form.querySelector("#overall-range").value = clampPercent(progress.overall);
    form.querySelector("#stage-progress").value = clampPercent(progress.stage);
    form.querySelector("#stage-range").value = clampPercent(progress.stage);
    form.querySelector("#current-stage-title").value = progress.title;
    form.querySelector("#current-stage-description").value = progress.description;
    form.querySelector("#progress-date").value = String(progress.date).slice(0, 10);
  }

  function bindProgressEditor() {
    const form = document.querySelector("#admin-progress-form");
    if (!form) return;
    const overall = form.querySelector("#overall-progress");
    const overallRange = form.querySelector("#overall-range");
    const stage = form.querySelector("#stage-progress");
    const stageRange = form.querySelector("#stage-range");
    overall.addEventListener("input", () => { overallRange.value = overall.value; });
    overallRange.addEventListener("input", () => { overall.value = overallRange.value; });
    stage.addEventListener("input", () => { stageRange.value = stage.value; });
    stageRange.addEventListener("input", () => { stage.value = stageRange.value; });

    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const progress = {
        overall: clampPercent(overall.value),
        stage: clampPercent(stage.value),
        title: form.querySelector("#current-stage-title").value.trim(),
        description: form.querySelector("#current-stage-description").value.trim(),
        date: form.querySelector("#progress-date").value
      };
      writeValue(KEYS.progress, progress);
      notify("Показатели сохранены. Обновите главную страницу, чтобы увидеть изменения.");
    });

    form.querySelector("#reset-progress").addEventListener("click", () => {
      writeValue(KEYS.progress, DEFAULT_PROGRESS);
      fillProgressForm();
      notify("Демонстрационные показатели восстановлены.");
    });
  }

  function bindDocumentUploader() {
    const input = document.querySelector("#document-upload");
    if (!input) return;
    const status = document.querySelector("#document-upload-status");
    input.addEventListener("change", async () => {
      const files = [...input.files];
      if (!files.length) return;
      let uploaded = 0;
      let skipped = 0;
      status.classList.remove("error");
      status.textContent = "Сохраняем документы…";
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024 || !/\.(pdf|docx?|xlsx?)$/i.test(file.name)) {
          skipped += 1;
          continue;
        }
        try {
          const id = makeId("document");
          await storeFile(id, file);
          customDocuments.push({
            id,
            title: file.name.replace(/\.[^.]+$/, ""),
            fileName: file.name,
            size: file.size,
            type: file.type,
            createdAt: new Date().toISOString()
          });
          writeValue(KEYS.documents, customDocuments);
          uploaded += 1;
        } catch {
          skipped += 1;
        }
      }
      input.value = "";
      renderAdminDocuments();
      status.classList.toggle("error", uploaded === 0 && skipped > 0);
      status.textContent = `${uploaded ? `Загружено: ${uploaded}.` : ""}${skipped ? ` Пропущено: ${skipped}. Проверьте формат и размер.` : ""}`;
      if (uploaded) notify("Документы добавлены на страницу проекта.");
    });
  }

  function bindChangeEditor() {
    const form = document.querySelector("#admin-change-form");
    if (!form) return;
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      customChanges.push({
        id: makeId("change"),
        title: data.title.trim(),
        date: data.date,
        status: data.status === "pending" ? "pending" : "accepted",
        summary: data.summary.trim(),
        details: data.details.trim(),
        createdAt: new Date().toISOString()
      });
      writeValue(KEYS.changes, customChanges);
      renderAdminChanges();
      form.reset();
      form.elements.date.value = new Date().toISOString().slice(0, 10);
      notify("Изменение добавлено на страницу проекта.");
    });
  }

  function bindPhotoUploader() {
    const input = document.querySelector("#photo-upload");
    if (!input) return;
    const status = document.querySelector("#photo-upload-status");
    input.addEventListener("change", async () => {
      const files = [...input.files];
      if (!files.length) return;
      let uploaded = 0;
      let skipped = 0;
      status.classList.remove("error");
      status.textContent = "Сохраняем фотографии…";
      for (const file of files) {
        if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
          skipped += 1;
          continue;
        }
        try {
          const id = makeId("photo");
          await storeFile(id, file);
          customPhotos.push({ id, name: file.name, size: file.size, type: file.type, createdAt: new Date().toISOString() });
          writeValue(KEYS.photos, customPhotos);
          uploaded += 1;
        } catch {
          skipped += 1;
        }
      }
      input.value = "";
      renderAdminPhotos();
      status.classList.toggle("error", uploaded === 0 && skipped > 0);
      status.textContent = `${uploaded ? `Загружено: ${uploaded}.` : ""}${skipped ? ` Пропущено: ${skipped}. Проверьте формат и размер.` : ""}`;
      if (uploaded) notify("Фотографии добавлены в галерею на главной.");
    });
  }

  applyProgress();
  renderCustomDocuments();
  renderCustomChanges();
  renderPublicPhotos();
  fillProgressForm();
  bindProgressEditor();
  renderAdminDocuments();
  renderAdminChanges();
  renderAdminPhotos();
  bindDocumentUploader();
  bindChangeEditor();
  bindPhotoUploader();

  window.addEventListener("pagehide", () => {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
  });
})();
