// Галерея товара: отображение текущего кадра синхронизировано с нативной
// прокруткой и полноэкранным dialog. Покупка и отправка отзывов — за Битрикс.
export function initProductReview() {
  const form = document.querySelector(".review-form");
  if (!form) return;
  const consent = form.querySelector('[name="consent"]');
  const submit = form.querySelector('[type="submit"]');
  const status = document.createElement('p');
  status.className = 'review-form__status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  form.append(status);
  let busy = false;
  let validated = false;
  let attemptId;
  let attemptSignature;
  form.noValidate = true;
  const name = form.elements.name;
  const review = form.elements.review;
  const rating = form.querySelector('fieldset');
  function showSuccess() {
    form.reset();
    validated = false;
    form.hidden = true;
    const confirmation = document.createElement('div');
    confirmation.className = 'review-form__success';
    confirmation.setAttribute('role', 'status');
    const heading = document.createElement('h2'); heading.textContent = 'Спасибо за отзыв';
    const text = document.createElement('p'); text.textContent = 'Отзыв отправлен на проверку. Он появится на странице после модерации.';
    const done = document.createElement('button');
    done.type = 'button'; done.className = 'button'; done.textContent = 'Готово';
    done.addEventListener('click', () => form.closest('dialog').close());
    confirmation.append(heading, text, done);
    form.after(confirmation);
    document.getElementById('review-dialog-title').hidden = true;
  }
  function error(control, message) {
    const host = control === rating ? rating : control;
    const id = `review-error-${control === rating ? 'rating' : control.name}`;
    let note = document.getElementById(id);
    if (!note) {
      note = document.createElement('p'); note.id = id; note.className = 'review-form__error'; host.after(note);
    }
    note.hidden = !message;
    note.textContent = message;
    host.setAttribute('aria-invalid', String(Boolean(message)));
    if (message) host.setAttribute('aria-describedby', id);
    else if (control === review) host.setAttribute('aria-describedby', 'review-length');
    else host.removeAttribute('aria-describedby');
    return Boolean(message);
  }
  function validate() {
    const invalid = [];
    if (error(name, name.value.trim().length < 2 || name.value.trim().length > 80 ? 'Введите имя от 2 до 80 символов' : '')) invalid.push(name);
    if (error(rating, !form.querySelector('[name="rating"]:checked') ? 'Выберите оценку' : '')) invalid.push(form.querySelector('[name="rating"]'));
    if (error(review, review.value.trim().length < 20 || review.value.trim().length > 2000 ? 'Введите отзыв от 20 до 2000 символов' : '')) invalid.push(review);
    return invalid;
  }
  consent.addEventListener('change', () => { submit.disabled = busy || !consent.checked; });
  form.addEventListener('input', () => { if (validated) validate(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !consent.checked) return;
    validated = true;
    const invalid = validate();
    if (invalid.length) { invalid[0].focus(); return; }
    const values = new FormData(form);
    values.set('name', name.value.trim());
    values.set('review', review.value.trim());
    const signature = JSON.stringify([...values]);
    if (signature !== attemptSignature) { attemptId = crypto.randomUUID(); attemptSignature = signature; }
    busy = true;
    const disabledBefore = new Map([...form.elements].map(control => [control, control.disabled]));
    [...form.elements].forEach(control => { control.disabled = true; });
    submit.disabled = true;
    submit.textContent = 'Отправляем…';
    submit.setAttribute('aria-busy', 'true');
    status.hidden = true;
    try {
      // Только подтверждённый ответ Битрикс показывает сообщение о модерации.
      const adapter = window.DesisanIntegrations?.sendProductReview;
      if (!adapter) throw new Error('Review integration is not configured');
      const result = await adapter(values, {attemptId});
      if (result?.status !== 'sent') {
        if (result?.errors) for (const [key, message] of Object.entries(result.errors)) {
          const control = key === 'rating' ? rating : form.elements[key];
          if (control) error(control, message);
        }
        throw new Error('Review was not accepted');
      }
      showSuccess();
    } catch {
      status.textContent = 'Не удалось отправить отзыв. Попробуйте ещё раз.';
      status.hidden = false;
      submit.textContent = 'Повторить';
    } finally {
      busy = false;
      disabledBefore.forEach((disabled, control) => { control.disabled = disabled; });
      submit.disabled = !consent.checked;
      submit.removeAttribute('aria-busy');
    }
  });
  const preview = form.dataset.reviewPreview;
  if (preview) {
    if (preview !== 'form' && preview !== 'validation') {
      name.value = 'Анна';
      review.value = 'Удобная сумка на каждый день. Вмещает всё необходимое, ремень регулируется.';
      form.querySelector('[name="rating"][value="5"]').checked = true;
      consent.checked = true;
      submit.disabled = false;
    }
    if (preview === 'validation') { validated = true; validate(); }
    if (preview === 'sending') {
      busy = true;
      [...form.elements].forEach(control => { control.disabled = true; });
      submit.textContent = 'Отправляем…';
      submit.setAttribute('aria-busy', 'true');
    }
    if (preview === 'error') {
      status.textContent = 'Не удалось отправить отзыв. Попробуйте ещё раз.';
      status.hidden = false;
      submit.textContent = 'Повторить';
    }
    if (preview === 'sent') showSuccess();
  }
}

export function initProductGallery() {
  const gallery = document.querySelector("[data-product-gallery]");
  const viewer = document.getElementById("product-viewer");
  if (!gallery || !viewer) return;
  const track = gallery.querySelector("[data-gallery-track]");
  document.querySelectorAll('[data-product-video-error]').forEach(error => {
    const player = error.parentElement.querySelector('video');
    const retry = error.querySelector('[data-product-video-retry]');
    player.addEventListener('error', () => { error.hidden = false; retry.disabled = false; retry.textContent = 'Повторить загрузку'; });
    player.addEventListener('loadeddata', () => { error.hidden = true; retry.disabled = false; retry.textContent = 'Повторить загрузку'; });
    retry.addEventListener('click', () => {
      retry.disabled = true; retry.textContent = 'Загружаем…'; player.load();
    });
  });
  // Ошибка отдельного файла не ломает размер галереи и покупку.
  gallery.querySelectorAll('.product-gallery__slide').forEach(slide => {
    const image = slide.querySelector('img');
    if (slide.hasAttribute('data-gallery-video')) return;
    const error = slide.querySelector('[data-gallery-error]');
    const label = slide.getAttribute('aria-label');
    const fail = () => { image.hidden = true; error.hidden = false; slide.setAttribute('aria-label', 'Повторить загрузку изображения'); };
    image.addEventListener('error', fail);
    image.addEventListener('load', () => { image.hidden = false; error.hidden = true; slide.setAttribute('aria-label', label); });
    if (gallery.dataset.galleryState === 'error' && slide === track.firstElementChild) fail();
    if (image.complete && !image.naturalWidth) fail();
    slide.addEventListener('click', event => {
      if (error.hidden) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const source = image.src;
      image.removeAttribute('src'); image.src = source;
    }, true);
  });
  const slides = [...gallery.querySelectorAll(".product-gallery__slide")];
  const thumbs = [...gallery.querySelectorAll("[data-gallery-thumb]")];
  const thumbTrack = gallery.querySelector("[data-gallery-thumbs]");
  const counter = gallery.querySelector("[data-gallery-counter]");
  const viewerImage = viewer.querySelector("[data-viewer-image]");
  const zoom = viewer.querySelector("#product-viewer-zoom");
  const photo = viewer.querySelector(".product-viewer__photo");
  const viewerVideo = viewer.querySelector('[data-viewer-video]');
  const viewerError = viewer.querySelector('[data-viewer-error]');
  viewerImage.addEventListener('error', () => { photo.hidden = true; viewerError.hidden = false; });
  viewerImage.addEventListener('load', () => { viewerError.hidden = true; photo.hidden = !viewerVideo.hidden; });
  viewer.querySelector('[data-viewer-retry]').addEventListener('click', () => {
    const source = viewerImage.src;
    viewerImage.removeAttribute('src'); viewerImage.src = source;
  });
  let current = 0;

  function update(index, moveTrack = false) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;
    if (moveTrack) track.scrollTo({ left: slides[current].offsetLeft - track.offsetLeft, behavior: "instant" });
    if (counter) counter.textContent = (current + 1) + " / " + slides.length;
    thumbs.forEach((button, i) => button.setAttribute("aria-pressed", String(i === current)));
    const video = slides[current].querySelector('video');
    viewerError.hidden = true;
    viewer.querySelector('[data-product-video-error]').hidden = true;
    gallery.querySelectorAll('video').forEach(player => { if (player !== video) player.pause(); });
    viewerVideo.pause();
    photo.hidden = Boolean(video);
    viewerVideo.hidden = !video;
    if (video) {
      if (viewerVideo.getAttribute('src') !== video.getAttribute('src')) viewerVideo.src = video.getAttribute('src');
      viewerVideo.poster = video.poster;
    } else {
      const source = slides[current].querySelector('img');
      viewerImage.src = source.src;
      viewerImage.alt = source.alt;
    }
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
  viewer.addEventListener('close', () => viewerVideo.pause());
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

