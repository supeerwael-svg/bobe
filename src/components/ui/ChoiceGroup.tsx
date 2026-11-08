interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  error?: string | null;
}

export function ChoiceGroup<T extends string>({ legend, name, value, options, onChange, error }: ChoiceGroupProps<T>) {
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-sm font-medium text-neutral-700">{legend}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-3 text-center text-base font-medium ring-1 transition duration-200 ${
                active
                  ? 'bg-primary-600 text-white ring-primary-600 shadow-sm shadow-primary-600/20'
                  : 'bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {error ? <p className="text-sm text-danger-700">{error}</p> : null}
    </fieldset>
  );
}
