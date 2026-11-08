import Splide from '@splidejs/splide';

// Оборачиваем только готовую серверную разметку. Контент и порядок карточек не меняем.
// Возвращаем экземпляр Splide для связи галерей; повторно один корень не подключаем.
export function createSlider(list, options = {}) {
  if (!list || !list.children.length) return null;
  if (list.desisanSlider) return list.desisanSlider;
  const root = document.createElement('div');
  root.className = 'splide desisan-slider';
  root.setAttribute('aria-label', list.getAttribute('aria-label') || 'Слайдер');
  const track = document.createElement('div');
  track.className = 'splide__track';
  list.before(root);
  root.append(track);
  track.append(list);
  list.classList.add('splide__list');
  [...list.children].forEach(slide => slide.classList.add('splide__slide'));
  const slider = new Splide(root, {
    arrows: false, pagination: false, autoplay: false,
    speed: 300, keyboard: 'focused', live: true,
    reducedMotion: { speed: 0, rewindSpeed: 0 },
    ...options,
  });
  list.desisanSlider = slider;
  return slider;
}

// Сохраняем кнопки макета. Положение и достижимость конца рассчитывает Splide.
function connectArrows(slider, previous, next) {
  const update = () => {
    if (previous) previous.disabled = slider.index === 0;
    if (next) next.disabled = slider.index >= slider.Components.Controller.getEnd();
  };
  previous?.addEventListener('click', () => slider.go('<'));
  next?.addEventListener('click', () => slider.go('>'));
  slider.on('mounted moved updated resized', update);
}

export function initRails() {
  document.querySelectorAll('[data-rail]').forEach(section => {
    const list = section.querySelector('[data-rail-track]');
    if (list?.desisanSlider) return;
    const category = list?.classList.contains('category-grid');
    const slider = createSlider(list, {
      fixedWidth: category ? 272 : 424, gap: 32,
      perMove: 1, omitEnd: true,
      breakpoints: {
        1919: { fixedWidth: category ? 264 : 368, gap: category ? 32 : 24 },
        // В макете ниже 1280 лента становится обычной сеткой, без слайдера.
        1279: { destroy: true },
      },
    });
    if (!slider) return;
    connectArrows(slider, section.querySelector('[data-rail-prev]'), section.querySelector('[data-rail-next]'));
    slider.mount();
  });
}

export function initHero() {
  document.querySelectorAll('[data-hero]').forEach(hero => {
    if (hero.querySelector('[data-hero-track]')?.desisanSlider) return;
    const slider = createSlider(hero.querySelector('[data-hero-track]'));
    if (!slider) return;
    connectArrows(slider, hero.querySelector('[data-hero-prev]'), hero.querySelector('[data-hero-next]'));
    slider.mount();
  });
}
