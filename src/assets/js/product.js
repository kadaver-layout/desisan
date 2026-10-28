// Галерея товара: отображение текущего кадра синхронизировано с нативной
// прокруткой и полноэкранным dialog. Покупка и отправка отзывов — за Битрикс.
export function initProductReview() {
  const form = document.querySelector(".review-form");
  if (!form) return;
  const consent = form.querySelector('[name="consent"]');
  const submit = form.querySelector('[type="submit"]');
  // Отправка доступна только после согласия на обработку данных.
  consent.addEventListener("change", () => { submit.disabled = !consent.checked; });
}

export function initProductGallery() {
  const gallery = document.querySelector("[data-product-gallery]");
  const viewer = document.getElementById("product-viewer");
  if (!gallery || !viewer) return;
  const track = gallery.querySelector("[data-gallery-track]");
  const slides = [...gallery.querySelectorAll(".product-gallery__slide")];
  const thumbs = [...gallery.querySelectorAll("[data-gallery-thumb]")];
  const thumbTrack = gallery.querySelector("[data-gallery-thumbs]");
  const counter = gallery.querySelector("[data-gallery-counter]");
  const viewerImage = viewer.querySelector("[data-viewer-image]");
  const zoom = viewer.querySelector("#product-viewer-zoom");
  const photo = viewer.querySelector(".product-viewer__photo");
  let current = 0;

  function update(index, moveTrack = false) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;
    if (moveTrack) track.scrollTo({ left: slides[current].offsetLeft - track.offsetLeft, behavior: "instant" });
    if (counter) counter.textContent = (current + 1) + " / " + slides.length;
    thumbs.forEach((button, i) => button.setAttribute("aria-pressed", String(i === current)));
    const source = slides[current].querySelector("img");
    viewerImage.src = source.src;
    viewerImage.alt = source.alt;
    zoom.checked = false;
    photo.scrollTo(0, 0);
    if (thumbTrack && thumbs[current]?.offsetParent) {
      const box = thumbs[current].getBoundingClientRect();
      const area = thumbTrack.getBoundingClientRect();
      if (box.left < area.left || box.right > area.right) thumbTrack.scrollBy({ left: box.left - area.left, behavior: "smooth" });
    }
  }

  thumbs.forEach((button, index) => button.addEventListener("click", () => update(index, true)));
  function attachArrows(root) {
    root.querySelector("[data-gallery-prev]")?.addEventListener("click", () => update(current - 1, true));
    root.querySelector("[data-gallery-next]")?.addEventListener("click", () => update(current + 1, true));
  }
  attachArrows(gallery);
  attachArrows(viewer);
  track.addEventListener("scroll", () => {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== current && slides[index]) update(index);
  }, { passive: true });
  viewer.addEventListener("desisan:open", () => update(current));
  viewer.addEventListener("keydown", event => {
    if (slides.length < 2) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); update(current - 1, true); }
    if (event.key === "ArrowRight") { event.preventDefault(); update(current + 1, true); }
  });

  // Свайп листает кадры только при обычном масштабе; pinch остаётся браузеру.
  let touchStart = null;
  photo.addEventListener("touchstart", event => {
    touchStart = event.touches.length === 1 && !zoom.checked ? event.touches[0].clientX : null;
  }, { passive: true });
  photo.addEventListener("touchend", event => {
    if (touchStart === null || event.changedTouches.length !== 1) return;
    const distance = event.changedTouches[0].clientX - touchStart;
    touchStart = null;
    if (Math.abs(distance) > 48 && slides.length > 1) {
      event.preventDefault();
      update(current + (distance < 0 ? 1 : -1), true);
    }
  }, { passive: false });

  // Увеличенное изображение можно передвигать мышью; кликом масштаб возвращается.
  let drag = null;
  let moved = false;
  photo.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || !zoom.checked) return;
    drag = { x: event.clientX, y: event.clientY, left: photo.scrollLeft, top: photo.scrollTop };
    moved = false;
    photo.setPointerCapture(event.pointerId);
  });
  photo.addEventListener("pointermove", event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    photo.scrollTo(drag.left - dx, drag.top - dy);
  });
  photo.addEventListener("pointerup", () => { drag = null; });
  photo.addEventListener("click", event => {
    if (moved) { event.preventDefault(); moved = false; }
  });
  update(0);
}

