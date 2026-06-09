const header = document.querySelector("[data-elevate]");
const inputs = {
  actsPerDay: document.querySelector("#actsPerDay"),
  minutesPerAct: document.querySelector("#minutesPerAct"),
  hourCost: document.querySelector("#hourCost"),
  workDays: document.querySelector("#workDays"),
};
const hoursSaved = document.querySelector("#hoursSaved");
const moneySaved = document.querySelector("#moneySaved");
const audienceCard = document.querySelector("#audience-card");
const audienceTabs = document.querySelectorAll("[data-audience]");
const demoForm = document.querySelector(".demo-form");
const formStatus = document.querySelector(".form-status");

const audienceCopy = {
  chief: {
    label: "Главбух",
    title: "Меньше ошибок в первичке и понятный контроль перед проводками",
    body:
      "Видны спорные поля, исправления и статус документов. Команда меньше набирает вручную и больше занимается контролем.",
  },
  accountant: {
    label: "Бухгалтер",
    title: "Не нужно вручную переносить каждый паспорт, адрес и строку лома",
    body:
      "Данные уже разложены по полям. Остается пройти подсветку, поправить спорное и подтвердить создание документов.",
  },
  owner: {
    label: "Собственник",
    title: "Быстрее закрытие смен и ниже зависимость от ручной рутины",
    body:
      "Сканы за смену быстрее попадают в учет, а руководитель видит понятный эффект в часах, загрузке бухгалтерии и дисциплине процесса.",
  },
};

function formatRub(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(value) {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value)} ч`;
}

function calculateSavings() {
  const acts = Number(inputs.actsPerDay.value) || 0;
  const minutes = Number(inputs.minutesPerAct.value) || 0;
  const cost = Number(inputs.hourCost.value) || 0;
  const days = Number(inputs.workDays.value) || 0;
  const manualHours = (acts * minutes * days) / 60;
  const savedHours = manualHours * 0.75;
  hoursSaved.textContent = formatHours(savedHours);
  moneySaved.textContent = formatRub(savedHours * cost);
}

function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
}

function setAudience(key) {
  const copy = audienceCopy[key];
  audienceTabs.forEach((tab) => {
    const isActive = tab.dataset.audience === key;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  audienceCard.innerHTML = `
    <p class="audience-label">${copy.label}</p>
    <h3>${copy.title}</h3>
    <p>${copy.body}</p>
  `;
}

Object.values(inputs).forEach((input) => input.addEventListener("input", calculateSavings));
audienceTabs.forEach((tab) => tab.addEventListener("click", () => setAudience(tab.dataset.audience)));
window.addEventListener("scroll", updateHeader, { passive: true });

demoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formStatus.textContent = "Спасибо. Свяжемся и договоримся о пилоте на ваших актах.";
  demoForm.reset();
});

if (window.lucide) {
  window.lucide.createIcons();
}

calculateSavings();
updateHeader();
