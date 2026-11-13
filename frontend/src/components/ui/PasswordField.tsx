import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Clase del input. Por defecto usa el estilo base de la app. */
  inputClassName?: string;
};

/** Campo de contraseña con botón para mostrar u ocultar el texto. */
export function PasswordField({ inputClassName = 'input', className = '', ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <input {...rest} type={visible ? 'text' : 'password'} className={`${inputClassName} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
