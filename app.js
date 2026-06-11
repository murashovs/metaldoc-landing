const formatNumber = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const calc = {
  acts: document.querySelector("#actsRange"),
  manual: document.querySelector("#manualRange"),
  review: document.querySelector("#reviewRange"),
  days: document.querySelector("#daysRange"),
  hourRate: document.querySelector("#hourRateRange"),
  actsOut: document.querySelector("#actsOut"),
  manualOut: document.querySelector("#manualOut"),
  reviewOut: document.querySelector("#reviewOut"),
  daysOut: document.querySelector("#daysOut"),
  hourRateOut: document.querySelector("#hourRateOut"),
  moneySaved: document.querySelector("#moneySaved"),
  hoursSaved: document.querySelector("#hoursSaved"),
  daysSaved: document.querySelector("#daysSaved"),
  factorSaved: document.querySelector("#factorSaved"),
};

function updateCalculator() {
  const acts = Number(calc.acts.value);
  const manual = Number(calc.manual.value);
  const review = Number(calc.review.value);
  const days = Number(calc.days.value);
  const hourRate = Number(calc.hourRate.value);

  const manualHours = (acts * manual * days) / 60;
  const reviewHours = (acts * review * days) / 60;
  const savedHours = Math.max(manualHours - reviewHours, 0);
  const savedDays = savedHours / 8;
  const savedMoney = savedHours * hourRate;
  const factor = reviewHours > 0 ? manualHours / reviewHours : 0;

  calc.actsOut.textContent = formatNumber.format(acts);
  calc.manualOut.textContent = formatNumber.format(manual);
  calc.reviewOut.textContent = review.toFixed(1).replace(".", ",");
  calc.daysOut.textContent = formatNumber.format(days);
  calc.hourRateOut.textContent = `${formatNumber.format(hourRate)} ₽`;
  calc.moneySaved.textContent = `${formatNumber.format(savedMoney)} ₽/мес`;
  calc.hoursSaved.textContent = `${formatNumber.format(savedHours)} ч/мес`;
  calc.daysSaved.textContent = `${formatNumber.format(savedDays)} дней`;
  calc.factorSaved.textContent = `в ${factor.toFixed(1).replace(".", ",")} раза`;
}

function calcSummaryText() {
  return [
    `актов в день: ${calc.acts.value}`,
    `мин на ручной ввод: ${calc.manual.value}`,
    `мин на проверку: ${calc.review.value}`,
    `рабочих дней: ${calc.days.value}`,
    `час бухгалтера: ${calc.hourRate.value} ₽`,
    `экономия: ${calc.moneySaved.textContent}, ${calc.hoursSaved.textContent}`,
  ].join("; ");
}

["acts", "manual", "review", "days", "hourRate"].forEach((key) => {
  calc[key].addEventListener("input", updateCalculator);
});

updateCalculator();

const FORM_ENDPOINT = "/api/lead";

async function sendLead(data) {
  const response = await fetch(FORM_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === "false") {
    throw new Error(result.message || "Ошибка отправки");
  }

  return result;
}

const form = document.querySelector(".lead-form");
const formNote = document.querySelector("#formNote");
const calcSummaryInput = document.querySelector("#calcSummary");

const initialButtonText = form.querySelector(".form-button span").textContent;

function setFormStatus(message, type) {
  formNote.textContent = message;
  formNote.classList.remove("success", "error");
  if (type) {
    formNote.classList.add(type);
  }
}

if (new URLSearchParams(window.location.search).get("sent") === "1") {
  setFormStatus("Заявка отправлена. Мы свяжемся, чтобы проверить распознавание на ваших актах.", "success");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  const trap = form.querySelector('input[name="website"]');
  if (trap?.value) {
    return;
  }

  if (calcSummaryInput) {
    calcSummaryInput.value = calcSummaryText();
  }

  const button = form.querySelector(".form-button");
  const buttonText = button.querySelector("span");
  const data = Object.fromEntries(new FormData(form).entries());
  data.page = window.location.href;
  data.referrer = document.referrer || "не указан";
  data.site = "robotpsa.ru";

  button.disabled = true;
  buttonText.textContent = "Отправляем...";
  setFormStatus("Отправляем заявку...", null);

  try {
    await sendLead(data);
    form.reset();
    buttonText.textContent = "Заявка отправлена";
    setFormStatus(
      "Заявка отправлена. Мы свяжемся, чтобы проверить распознавание на ваших актах.",
      "success",
    );
    window.setTimeout(() => {
      buttonText.textContent = initialButtonText;
    }, 3200);
  } catch (error) {
    buttonText.textContent = initialButtonText;
    setFormStatus(
      "Не удалось отправить автоматически. Позвоните по номеру +7 495 970-45-89.",
      "error",
    );
  } finally {
    button.disabled = false;
  }
});

const header = document.querySelector("[data-elevate]");

function updateHeaderElevation() {
  header.style.boxShadow =
    window.scrollY > 20 ? "0 12px 30px rgba(22, 32, 39, 0.08)" : "none";
}

window.addEventListener("scroll", updateHeaderElevation, { passive: true });
updateHeaderElevation();

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector("#siteNav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const open = header.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  });

  siteNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      header.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.classList.contains("nav-open")) {
      header.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.focus();
    }
  });
}

function initRevealEffects() {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    return;
  }

  const revealTargets = document.querySelectorAll(
    [
      ".hero-copy > *",
      ".proof-strip-item",
      ".section-kicker",
      ".section-heading h2",
      ".section-copy",
      ".info-card",
      ".outcome-item",
      ".step-card",
      ".comparison-card",
      ".comparison-summary",
      ".field-cloud span",
      ".calculator-copy",
      ".calc-panel",
      ".calc-results",
      ".audience-card",
      ".security-board",
      ".security-copy",
      ".proof-copy",
      ".proof-item",
      ".faq-item",
      ".demo-copy",
      ".demo-points > div",
      ".lead-form",
    ].join(","),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const target = entry.target;
        target.classList.add("reveal-enter");
        void target.offsetWidth;
        target.classList.add("in-view");
        observer.unobserve(target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.14 },
  );

  revealTargets.forEach((target, index) => {
    target.style.setProperty("--reveal-delay", `${(index % 4) * 70}ms`);
    observer.observe(target);
  });
}

initRevealEffects();

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "aria-hidden": "true",
      },
    });
    return true;
  }
  return false;
}

if (!initIcons()) {
  window.addEventListener("load", initIcons);
}
