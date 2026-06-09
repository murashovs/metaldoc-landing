const formatNumber = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const calc = {
  acts: document.querySelector("#actsRange"),
  manual: document.querySelector("#manualRange"),
  review: document.querySelector("#reviewRange"),
  days: document.querySelector("#daysRange"),
  actsOut: document.querySelector("#actsOut"),
  manualOut: document.querySelector("#manualOut"),
  reviewOut: document.querySelector("#reviewOut"),
  daysOut: document.querySelector("#daysOut"),
  hoursSaved: document.querySelector("#hoursSaved"),
  daysSaved: document.querySelector("#daysSaved"),
  factorSaved: document.querySelector("#factorSaved"),
};

function updateCalculator() {
  const acts = Number(calc.acts.value);
  const manual = Number(calc.manual.value);
  const review = Number(calc.review.value);
  const days = Number(calc.days.value);

  const manualHours = (acts * manual * days) / 60;
  const reviewHours = (acts * review * days) / 60;
  const savedHours = Math.max(manualHours - reviewHours, 0);
  const savedDays = savedHours / 8;
  const factor = reviewHours > 0 ? manualHours / reviewHours : 0;

  calc.actsOut.textContent = formatNumber.format(acts);
  calc.manualOut.textContent = formatNumber.format(manual);
  calc.reviewOut.textContent = review.toFixed(1).replace(".", ",");
  calc.daysOut.textContent = formatNumber.format(days);
  calc.hoursSaved.textContent = `${formatNumber.format(savedHours)} ч/мес`;
  calc.daysSaved.textContent = `${formatNumber.format(savedDays)} дней`;
  calc.factorSaved.textContent = `в ${factor.toFixed(1).replace(".", ",")} раза`;
}

["acts", "manual", "review", "days"].forEach((key) => {
  calc[key].addEventListener("input", updateCalculator);
});

updateCalculator();

const form = document.querySelector(".lead-form");
const formNote = document.querySelector("#formNote");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const company = data.get("company") || "вашей компании";
  formNote.textContent = `Готово: заявка для ${company} сформирована. Мы свяжемся, чтобы проверить распознавание на ваших актах.`;
  formNote.classList.add("success");
  form.querySelector(".form-button span").textContent = "Заявка готова";
});

const header = document.querySelector("[data-elevate]");

function updateHeaderElevation() {
  header.style.boxShadow =
    window.scrollY > 20 ? "0 12px 30px rgba(22, 32, 39, 0.08)" : "none";
}

window.addEventListener("scroll", updateHeaderElevation, { passive: true });
updateHeaderElevation();

window.addEventListener("load", () => {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "aria-hidden": "true",
      },
    });
  }
});
