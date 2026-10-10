import { useEffect, useRef, type ReactNode } from 'react';
import { readStageSectionOrder, saveStageSectionOrder } from '../../services/stageResponseService';

const FIXED_SECTION_COUNT = 3;

export function StageSectionOrder({
  projectCode,
  stageName,
  children
}: {
  projectCode: string;
  stageName: string;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const rootCandidate = host?.querySelector<HTMLElement>('.mx-auto');
    if (!rootCandidate) return;
    const root = rootCandidate;

    root.style.display = 'flex';
    root.style.flexDirection = 'column';

    function getSections() {
      return (Array.from(root.children) as HTMLElement[])
        .slice(FIXED_SECTION_COUNT)
        .filter((element) => {
          if (element.dataset.stageSectionIgnore) return false;
          const hasCompletionAction = Array.from(element.querySelectorAll('button')).some((button) =>
            /mark .+ complete/i.test(button.textContent?.trim() || '')
          );
          if (hasCompletionAction) {
            element.dataset.stageSectionIgnore = 'true';
            element.querySelector<HTMLElement>(':scope > [data-stage-section-controls]')?.remove();
            element.style.order = '';
            return false;
          }
          return true;
        });
    }

    function refresh() {
      const elements = Array.from(root.children) as HTMLElement[];
      elements.slice(0, FIXED_SECTION_COUNT).forEach((element, index) => {
        element.style.order = String(index);
        element.draggable = false;
      });

      let builtInIndex = 0;
      getSections().forEach((element) => {
        if (!element.dataset.stageSection) {
          element.dataset.stageSection = `built-in-${builtInIndex}`;
          builtInIndex += 1;
        }
      });

      const sections = getSections();
      const ids = sections.map((element) => element.dataset.stageSection).filter(Boolean) as string[];
      const saved = readStageSectionOrder(projectCode, stageName);
      const order = [...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))];

      sections.forEach((element) => {
        const id = element.dataset.stageSection;
        if (!id) return;
        element.style.order = String(FIXED_SECTION_COUNT + order.indexOf(id));
        element.style.position = 'relative';
        element.classList.add('stage-section-orderable');
        element.draggable = false;
        element.style.cursor = '';

        let controls = element.querySelector<HTMLElement>(':scope > [data-stage-section-controls]');
        if (!controls) {
          controls = document.createElement('div');
          controls.dataset.stageSectionControls = 'true';
          controls.className = 'stage-section-order-controls';
          element.appendChild(controls);
        }
        controls.innerHTML = '';
        const position = order.indexOf(id);
        controls.appendChild(makeArrowButton('up', position <= 0, id));
        controls.appendChild(makeArrowButton('down', position >= order.length - 1, id));
      });
    }

    function makeArrowButton(direction: 'up' | 'down', disabled: boolean, id: string) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.stageSectionMove = direction;
      button.dataset.stageSectionId = id;
      button.className = 'stage-section-order-button';
      button.disabled = disabled;
      button.title = `${direction === 'up' ? 'Move section up' : 'Move section down'}`;
      button.ariaLabel = button.title;
      button.textContent = direction === 'up' ? '↑' : '↓';
      return button;
    }

    function moveSection(direction: 'up' | 'down', id: string) {
      const sections = getSections();
      const ids = sections.map((element) => element.dataset.stageSection).filter(Boolean) as string[];
      const saved = readStageSectionOrder(projectCode, stageName);
      const order = [...saved.filter((savedId) => ids.includes(savedId)), ...ids.filter((sectionId) => !saved.includes(sectionId))];
      const index = order.indexOf(id);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      saveStageSectionOrder(projectCode, stageName, order);
      refresh();
    }

    function onClick(event: MouseEvent) {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-stage-section-move]');
      if (!button || !root.contains(button) || button.disabled) return;
      const direction = button.dataset.stageSectionMove;
      const id = button.dataset.stageSectionId;
      if ((direction === 'up' || direction === 'down') && id) moveSection(direction, id);
    }

    refresh();
    root.addEventListener('click', onClick);
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true });
    return () => {
      observer.disconnect();
      root.removeEventListener('click', onClick);
    };
  }, [projectCode, stageName]);

  return <div ref={hostRef} className="contents">{children}</div>;
}
