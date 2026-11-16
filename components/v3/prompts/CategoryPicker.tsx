"use client";

export const NEW_CATEGORY = "__new__";

export type Draft = { text: string; category: string; newCategory: string };

export const EMPTY_DRAFT: Draft = { text: "", category: "", newCategory: "" };

export function draftCategory(d: Draft): string {
  return d.category === NEW_CATEGORY ? d.newCategory : d.category;
}

/** Category select for a prompt being added or edited, with a free-text new category. */
export function CategoryPicker({
  draft,
  categories,
  disabled,
  onChange,
}: {
  draft: Draft;
  categories: string[];
  disabled: boolean;
  onChange: (d: Draft) => void;
}) {
  return (
    <div className="pe-category">
      <select
        value={draft.category}
        disabled={disabled}
        onChange={(e) => onChange({ ...draft, category: e.target.value })}
        aria-label="Category"
      >
        <option value="" disabled>
          Category
        </option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_CATEGORY}>New category…</option>
      </select>
      {draft.category === NEW_CATEGORY ? (
        <input
          type="text"
          value={draft.newCategory}
          disabled={disabled}
          maxLength={40}
          placeholder="New category name"
          onChange={(e) => onChange({ ...draft, newCategory: e.target.value })}
          aria-label="New category name"
        />
      ) : null}
    </div>
  );
}
