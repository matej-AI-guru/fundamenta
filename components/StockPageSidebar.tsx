'use client';

import { useEffect, useState } from 'react';

interface Section {
  id: string;
  label: string;
}

export default function StockPageSidebar({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -55% 0px', threshold: 0 },
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="hidden lg:block lg:w-44 shrink-0 sticky top-[80px] self-start pt-6 pb-10">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 mb-3 px-3">
        Sadržaj
      </p>
      <ul className="space-y-0.5">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`block text-sm py-1.5 pl-3 pr-2 rounded-md transition-all border-l-2 ${
                activeId === id
                  ? 'border-blue-500 text-blue-600 bg-blue-50/60 font-medium'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
