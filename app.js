const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const toast = $("#toast");
const toastMessage = $("#toast-message");
let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 5000);
}

$("#toast button").addEventListener("click", () => toast.classList.remove("visible"));

const menuButton = $(".menu-button");
const mainNav = $("#main-nav");

function closeMenu() {
  mainNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}

menuButton.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

$$("a", mainNav).forEach(link => link.addEventListener("click", closeMenu));

document.addEventListener("click", event => {
  if (!event.target.closest(".header-shell")) closeMenu();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenu();
});

const observedSections = $$("main section[id]");
const navLinks = $$("a[href^='#']", mainNav);

if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    navLinks.forEach(link => {
      link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  }, { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.1, 0.4] });

  observedSections.forEach(section => sectionObserver.observe(section));
}

const dialogs = $$("dialog");

function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  closeMenu();
  dialog.showModal();
  document.body.classList.add("modal-open");
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

dialogs.forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeDialog(dialog);
  });

  dialog.addEventListener("close", () => {
    if (!dialogs.some(item => item.open)) document.body.classList.remove("modal-open");
  });

  $$('[data-close]', dialog).forEach(button => {
    button.addEventListener("click", () => closeDialog(dialog));
  });
});

$("[data-open-gallery]")?.addEventListener("click", () => openDialog($("#gallery-dialog")));
$("[data-open-report]")?.addEventListener("click", () => openDialog($("#report-dialog")));

const tourDialog = $("#tour-dialog");
const tourForm = $("#tour-form");
const tourDateInput = $("#tour-date-input");
let selectedTourButton = $(".date-option.active");

function updateSelectedTour() {
  if (!selectedTourButton) return;
  const date = selectedTourButton.dataset.date;
  const spots = selectedTourButton.dataset.spots;
  $("#tour-selected-date").textContent = date;
  $("#tour-selected-spots").textContent = `${spots} мест`;
  tourDateInput.value = date;
}

$$(".date-option").forEach(button => {
  button.addEventListener("click", () => {
    $$(".date-option").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    selectedTourButton = button;
    updateSelectedTour();
  });
});

$$('[data-open-tour]').forEach(button => {
  button.addEventListener("click", () => {
    updateSelectedTour();
    openDialog(tourDialog);
  });
});

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function validateForm(form) {
  let valid = true;

  $$("input, select, textarea", form).forEach(field => {
    const fieldWrapper = field.closest(".field");
    const checkboxWrapper = field.closest(".checkbox-field");
    fieldWrapper?.classList.remove("invalid");
    checkboxWrapper?.classList.remove("invalid");
    $("#file-field")?.classList.remove("invalid");

    let fieldValid = field.checkValidity();
    if (field.type === "tel" && field.required) {
      fieldValid = field.value.replace(/\D/g, "").length >= 10;
    }

    if (!fieldValid) {
      valid = false;
      if (field.type === "checkbox") checkboxWrapper?.classList.add("invalid");
      else if (field.type === "file") $("#file-field")?.classList.add("invalid");
      else fieldWrapper?.classList.add("invalid");
    }
  });

  return valid;
}

$$("form input, form select, form textarea").forEach(field => {
  const eventName = field.type === "checkbox" || field.type === "file" || field.tagName === "SELECT" ? "change" : "input";
  field.addEventListener(eventName, () => {
    field.closest(".field")?.classList.remove("invalid");
    field.closest(".checkbox-field")?.classList.remove("invalid");
    if (field.type === "file") $("#file-field")?.classList.remove("invalid");
  });
});

tourForm?.addEventListener("submit", event => {
  event.preventDefault();
  if (!validateForm(tourForm)) {
    showToast("Проверьте имя, телефон и согласие на обработку данных.");
    return;
  }

  const data = Object.fromEntries(new FormData(tourForm));
  const bookings = readStorage("dom-uparka-tours", []);
  bookings.push({ ...data, createdAt: new Date().toISOString() });
  const saved = writeStorage("dom-uparka-tours", bookings);
  const guestCount = Number(data.guests);
  const remainingSpots = Math.max(0, Number(selectedTourButton.dataset.spots) - guestCount);
  selectedTourButton.dataset.spots = String(remainingSpots);
  $("i", selectedTourButton).textContent = `${remainingSpots} мест`;

  closeDialog(tourDialog);
  tourForm.reset();
  showToast(saved
    ? `Запись на ${data.date} сохранена в демо на этом устройстве.`
    : "Запись заполнена, но браузер не разрешил локальное сохранение.");
});

const contractorDialog = $("#contractor-dialog");
const contractorForm = $("#contractor-form");
const tenderSelect = $("#tender-select");
const proposalFile = $("#proposal-file");

$$('[data-open-contractor]').forEach(button => {
  button.addEventListener("click", () => {
    if (contractorDialog) openDialog(contractorDialog);
    else $("#proposal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

$$("[data-tender]").forEach(button => {
  button.addEventListener("click", () => {
    if (!tenderSelect) return;
    tenderSelect.value = button.dataset.tender;
    tenderSelect.closest(".field").classList.remove("invalid");
    if (contractorDialog) openDialog(contractorDialog);
    else $("#proposal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

proposalFile?.addEventListener("change", () => {
  const file = proposalFile.files[0];
  if (!file) {
    $("#file-title").textContent = "Прикрепить коммерческое предложение *";
    $("#file-description").textContent = "PDF, DOC, DOCX, XLS или XLSX · максимум 10 МБ";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    proposalFile.value = "";
    $("#file-title").textContent = "Файл слишком большой";
    $("#file-description").textContent = "Выберите файл размером до 10 МБ";
    $("#file-field").classList.add("invalid");
    return;
  }

  $("#file-title").textContent = file.name;
  $("#file-description").textContent = `${(file.size / 1024 / 1024).toFixed(2)} МБ · файл выбран`;
});

contractorForm?.addEventListener("submit", event => {
  event.preventDefault();
  if (!validateForm(contractorForm) || !proposalFile.files[0]) {
    showToast("Заполните обязательные поля и прикрепите файл до 10 МБ.");
    return;
  }

  const data = Object.fromEntries(new FormData(contractorForm));
  delete data.proposal;
  data.file = {
    name: proposalFile.files[0].name,
    size: proposalFile.files[0].size,
    type: proposalFile.files[0].type
  };

  const proposals = readStorage("dom-uparka-proposals", []);
  proposals.push({ ...data, createdAt: new Date().toISOString() });
  const saved = writeStorage("dom-uparka-proposals", proposals);

  closeDialog(contractorDialog);
  contractorForm.reset();
  $("#file-title").textContent = "Прикрепить коммерческое предложение *";
  $("#file-description").textContent = "PDF, DOC, DOCX, XLS или XLSX · максимум 10 МБ";
  showToast(saved
    ? "Предложение сохранено в демо. Для реальной отправки потребуется подключить сервер."
    : "Предложение заполнено, но браузер не разрешил локальное сохранение.");
});

const pollForm = $("#poll-form");
const pollCard = $("#poll-card");
const voteButton = $("#vote-button");
const pollOptions = $$(".poll-option");
const baseVotes = [53, 48, 25];
let selectedPollValue = null;

function renderPollResults(userChoice) {
  const votes = baseVotes.map((count, index) => count + (index === userChoice ? 1 : 0));
  const total = votes.reduce((sum, count) => sum + count, 0);
  const percentages = votes.map(count => Math.round(count / total * 100));
  const difference = 100 - percentages.reduce((sum, value) => sum + value, 0);
  percentages[percentages.indexOf(Math.max(...percentages))] += difference;

  pollCard.classList.add("show-results");
  pollOptions.forEach((option, index) => {
    const input = $("input", option);
    input.disabled = true;
    option.classList.toggle("selected", index === userChoice);
    $(".poll-percent", option).textContent = `${percentages[index]}%`;
    $(".poll-bar i", option).style.width = `${percentages[index]}%`;
  });

  voteButton.disabled = true;
  voteButton.innerHTML = "Ваш голос учтён<svg><use href='#icon-check'></use></svg>";
  $("#poll-note").textContent = `Спасибо! Участвовали ${total} горожан. Голос сохранён на этом устройстве.`;
}

pollOptions.forEach((option, index) => {
  $("input", option).addEventListener("change", event => {
    selectedPollValue = index;
    pollOptions.forEach(item => item.classList.toggle("selected", item === option));
    voteButton.disabled = false;
    voteButton.innerHTML = "Проголосовать<svg><use href='#icon-arrow'></use></svg>";
    event.currentTarget.setAttribute("aria-label", event.currentTarget.value);
  });
});

pollForm?.addEventListener("submit", event => {
  event.preventDefault();
  if (selectedPollValue === null) return;
  writeStorage("dom-uparka-vote", selectedPollValue);
  renderPollResults(selectedPollValue);
  showToast("Спасибо! Ваш голос сохранён на этом устройстве.");
});

const savedVote = readStorage("dom-uparka-vote", null);
if (Number.isInteger(savedVote) && savedVote >= 0 && savedVote < pollOptions.length) {
  selectedPollValue = savedVote;
  const savedInput = $("input", pollOptions[savedVote]);
  savedInput.checked = true;
  renderPollResults(savedVote);
}

let activeChangeFilter = "all";
let showAllChanges = false;
const changeItems = $$(".change-item");
const showAllButton = $("#show-all-changes");

function applyChangeFilter() {
  changeItems.forEach(item => {
    const matchesFilter = activeChangeFilter === "all" || item.dataset.status === activeChangeFilter;
    const isCollapsedExtra = item.classList.contains("extra-change") && activeChangeFilter === "all" && !showAllChanges;
    item.hidden = !matchesFilter || isCollapsedExtra;
  });
  showAllButton.hidden = activeChangeFilter !== "all";
}

$$("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    activeChangeFilter = button.dataset.filter;
    $$("[data-filter]").forEach(item => item.classList.toggle("active", item === button));
    applyChangeFilter();
  });
});

changeItems.forEach(item => {
  item.addEventListener("click", () => {
    const expanded = item.getAttribute("aria-expanded") === "true";
    item.setAttribute("aria-expanded", String(!expanded));
  });
});

showAllButton?.addEventListener("click", () => {
  showAllChanges = !showAllChanges;
  showAllButton.innerHTML = showAllChanges
    ? "Скрыть старые изменения<svg><use href='#icon-chevron'></use></svg>"
    : "Показать всю историю<svg><use href='#icon-chevron'></use></svg>";
  applyChangeFilter();
});

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$$("[data-document]").forEach(button => {
  button.addEventListener("click", () => {
    const title = button.dataset.document;
    downloadTextFile(
      `${title} — демо.txt`,
      `${title}\nДворец культуры, Комсомольск-на-Амуре\nРабочая документация 04-08/724-ГП, 2023\nПодрядчик: ООО «СМУ-90»\n\nЭто демонстрационный файл. В рабочей версии портала здесь будет актуальный PDF-документ.`
    );
    showToast(`Демо-документ «${title}» скачан.`);
  });
});

$("#download-report")?.addEventListener("click", () => {
  downloadTextFile(
    "Отчёт о строительстве — ноябрь 2026.txt",
    "Дворец культуры — отчёт о реконструкции\nНоябрь 2026\nПодрядчик: ООО «СМУ-90»\n\nОбщая готовность: 48%\nРост за месяц: +3%\n\nОбновлены данные по текущему этапу реконструкции.\nПроведён контроль качества выполненных работ.\nПередан новый фотоотчёт.\nНарушений безопасности не зафиксировано.\n\nДемонстрационный отчёт."
  );
  showToast("Отчёт за ноябрь скачан.");
});

$(".notification-button")?.addEventListener("click", () => {
  $(".notification-button > span").hidden = true;
  showToast("Вы в курсе всех изменений. Новых уведомлений нет.");
});
