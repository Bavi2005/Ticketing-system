import { useId, useState } from "react";

export default function PasswordInput({ id, ref, type: _type, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input {...props} ref={ref} id={inputId} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={inputId}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
