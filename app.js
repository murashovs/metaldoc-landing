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

  const button = form.querySelector(".form-button");
  const buttonText = button.querySelector("span");
  const data = Object.fromEntries(new FormData(form).entries());
  data.page = window.location.href;
  data.referrer = document.referrer || "не указан";

  button.disabled = true;
  buttonText.textContent = "Отправляем...";
  setFormStatus("Отправляем заявку на doctormail@yandex.ru.", null);

  try {
    const response = await fetch("https://formsubmit.co/ajax/doctormail@yandex.ru", {
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
      "Не удалось отправить автоматически. Напишите напрямую на doctormail@yandex.ru.",
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

window.addEventListener("load", () => {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "aria-hidden": "true",
      },
    });
  }
});
