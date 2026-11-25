import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return <span className="password-input">
    <input {...props} type={visible ? "text" : "password"} />
    <button type="button" className="icon" aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </span>;
}
