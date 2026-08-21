"""Optional accessibility host for Rearvy desktop workflows.

This process is deliberately one-request/one-response and communicates only
through JSON stdin/stdout. Electron controls approval, policy, and fallback;
the host only performs the already-approved semantic accessibility operation.
"""

from __future__ import annotations

import importlib.util
import json
import sys
import time
from typing import Any


ROLE_MAP = {
    "button": "BUTTON",
    "edit": "TEXT_FIELD",
    "input": "TEXT_FIELD",
    "textbox": "TEXT_FIELD",
    "checkbox": "CHECK_BOX",
    "combobox": "COMBO_BOX",
    "listitem": "LIST_ITEM",
    "menuitem": "MENU_ITEM",
    "radiobutton": "RADIO_BUTTON",
    "tabitem": "TAB",
    "hyperlink": "LINK",
}


def text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def selector(action: dict[str, Any]) -> dict[str, Any]:
    return {
        "text": text(action.get("text") or action.get("label") or action.get("name") or action.get("target")),
        "role": text(action.get("controlType") or action.get("role") or action.get("kind")),
        "app": text(action.get("app") or action.get("appName") or action.get("application")),
        "timeout": max(0.5, min(15, float(action.get("timeoutMs") or action.get("timeout") or 8000) / 1000)),
    }


def element_dict(element: Any) -> dict[str, Any]:
    position = getattr(element, "position", None) or (0, 0)
    size = getattr(element, "size", None) or (0, 0)
    states = [str(state).split(".")[-1].lower() for state in (getattr(element, "states", None) or [])]
    return {
        "id": getattr(element, "id", None),
        "name": getattr(element, "name", "") or "",
        "controlType": str(getattr(element, "role", "") or "").split(".")[-1],
        "app": getattr(element, "app", "") or "",
        "x": int(position[0] or 0),
        "y": int(position[1] or 0),
        "width": int(size[0] or 0),
        "height": int(size[1] or 0),
        "centerX": int((position[0] or 0) + (size[0] or 0) / 2),
        "centerY": int((position[1] or 0) + (size[1] or 0) / 2),
        "states": states,
        "isEnabled": "enabled" in states or "sensitive" in states,
        "isVisible": "visible" in states or "showing" in states,
        "isSelected": "selected" in states or "checked" in states,
        "value": getattr(element, "value", None),
    }


def touchpoint_role(tp: Any, value: str) -> Any:
    if not value:
        return None
    role_name = ROLE_MAP.get(value.lower().replace(" ", ""), value.upper().replace(" ", "_"))
    return getattr(tp.Role, role_name, None)


def touchpoint_find(tp: Any, action: dict[str, Any], wait: bool = False) -> list[Any]:
    query = selector(action)
    if not query["text"]:
        raise ValueError("Touchpoint actions require a text label.")
    kwargs: dict[str, Any] = {"app": query["app"] or None, "max_results": 25}
    role = touchpoint_role(tp, query["role"])
    if role is not None:
        kwargs["role"] = role
    if wait:
        return list(tp.wait_for(query["text"], timeout=query["timeout"], **kwargs))
    return list(tp.find(query["text"], **kwargs))


def touchpoint_execute(operation: str, action: dict[str, Any]) -> Any:
    import touchpoint as tp  # type: ignore

    # Preserve semantic targeting: Touchpoint must not silently switch to a
    # coordinate click. Rearvy's explicit, auditable fallback handles that.
    tp.configure(fallback_input=False)
    if operation == "list":
        query = selector(action)
        elements = tp.elements(app=query["app"] or None, named_only=True)
        limit = max(1, min(200, int(action.get("maxElements") or action.get("maxItems") or 80)))
        return {"elements": [element_dict(item) for item in elements[:limit]]}

    matches = touchpoint_find(tp, action, wait=operation == "wait")
    if not matches:
        raise LookupError("No matching accessibility element was found.")
    item = matches[0]
    if operation in {"find", "state", "value", "wait"}:
        if operation == "value":
            value = tp.get_text_content(item)
            result = element_dict(item)
            result["value"] = value
            result["valueLength"] = len(value or "")
            return result
        return element_dict(item)
    if operation == "invoke":
        tp.action(item, "activate")
    elif operation == "click":
        tp.click(item)
    elif operation == "setValue":
        value = str(action.get("value") or action.get("textToSet") or action.get("input") or action.get("content") or "")
        tp.set_value(item, value, replace=True)
    elif operation == "type":
        value = str(action.get("value") or action.get("textToType") or action.get("input") or action.get("content") or "")
        tp.set_value(item, value, replace=action.get("clear") is not False)
    elif operation == "toggle":
        tp.click(item)
    elif operation == "focus":
        tp.action(item, "focus")
    elif operation in {"expand", "collapse", "select"}:
        tp.action(item, operation)
    elif operation == "shortcut":
        keys = str(action.get("keys") or action.get("shortcut") or "")
        tp.set_value(item, keys)
    elif operation == "scroll":
        tp.action(item, "scroll")
    else:
        raise ValueError(f"Unsupported Touchpoint operation: {operation}")
    return element_dict(item)


def pywinauto_find(action: dict[str, Any]) -> list[Any]:
    from pywinauto import Desktop  # type: ignore

    query = selector(action)
    if not query["text"]:
        raise ValueError("pywinauto actions require a text label.")
    requested_role = query["role"]
    control_type = {
        "checkbox": "CheckBox", "combobox": "ComboBox", "edit": "Edit", "input": "Edit",
        "textbox": "Edit", "button": "Button", "listitem": "ListItem", "menuitem": "MenuItem",
        "radiobutton": "RadioButton", "tabitem": "TabItem", "hyperlink": "Hyperlink",
    }.get(requested_role.lower().replace(" ", ""), requested_role or None)
    results: list[Any] = []
    for window in Desktop(backend="uia").windows():
        try:
            candidates = window.descendants(control_type=control_type) if control_type else window.descendants()
            for candidate in candidates:
                name = str(getattr(candidate.element_info, "name", "") or "")
                if query["text"].lower() in name.lower():
                    results.append(candidate)
        except Exception:
            continue
    return results


def pywinauto_element_dict(item: Any) -> dict[str, Any]:
    info = item.element_info
    rect = item.rectangle()
    return {
        "id": str(getattr(info, "runtime_id", "") or ""), "name": getattr(info, "name", "") or "",
        "controlType": getattr(info, "control_type", "") or "", "x": int(rect.left), "y": int(rect.top),
        "width": int(rect.width()), "height": int(rect.height()), "centerX": int((rect.left + rect.right) / 2),
        "centerY": int((rect.top + rect.bottom) / 2), "isEnabled": bool(item.is_enabled()),
        "isVisible": bool(item.is_visible()), "isSelected": bool(item.is_selected()) if hasattr(item, "is_selected") else False,
    }


def pywinauto_execute(operation: str, action: dict[str, Any]) -> Any:
    if operation == "list":
        return {"elements": [pywinauto_element_dict(item) for item in pywinauto_find(action)[:200]]}
    deadline = time.monotonic() + selector(action)["timeout"]
    matches = pywinauto_find(action)
    while not matches and operation == "wait" and time.monotonic() < deadline:
        time.sleep(0.2)
        matches = pywinauto_find(action)
    if not matches:
        raise LookupError("No matching accessibility element was found.")
    item = matches[0]
    if operation in {"find", "state", "wait"}:
        return pywinauto_element_dict(item)
    if operation == "value":
        result = pywinauto_element_dict(item)
        result["value"] = item.window_text()
        result["valueLength"] = len(result["value"])
        return result
    if operation in {"invoke", "click", "toggle"}:
        if hasattr(item, "invoke"):
            item.invoke()
        else:
            item.click_input()
    elif operation == "focus":
        item.set_focus()
    elif operation == "select":
        if hasattr(item, "select"):
            item.select()
        else:
            item.click_input()
    elif operation == "expand":
        if hasattr(item, "expand"):
            item.expand()
    elif operation == "collapse":
        if hasattr(item, "collapse"):
            item.collapse()
    elif operation in {"setValue", "type"}:
        value = str(action.get("value") or action.get("textToSet") or action.get("textToType") or action.get("input") or action.get("content") or "")
        if hasattr(item, "set_edit_text"):
            item.set_edit_text(value)
        else:
            item.click_input()
            if action.get("clear") is not False:
                item.type_keys("^a")
            item.type_keys(value, with_spaces=True)
    elif operation == "shortcut":
        keys = str(action.get("keys") or action.get("shortcut") or "")
        item.set_focus()
        item.type_keys(keys)
    elif operation == "scroll":
        direction = str(action.get("direction") or "down").lower()
        item.scroll(direction, "page")
    else:
        raise ValueError(f"Unsupported pywinauto operation: {operation}")
    return pywinauto_element_dict(item)


def uiautomation_find(action: dict[str, Any]) -> list[Any]:
    import uiautomation as uia  # type: ignore

    query = selector(action)
    if not query["text"]:
        raise ValueError("uiautomation actions require a text label.")
    requested_role = query["role"]
    control_type = {
        "checkbox": "CheckBoxControl", "combobox": "ComboBoxControl", "edit": "EditControl",
        "input": "EditControl", "textbox": "EditControl", "button": "ButtonControl",
        "listitem": "ListItemControl", "menuitem": "MenuItemControl",
        "radiobutton": "RadioButtonControl", "tabitem": "TabItemControl", "hyperlink": "HyperlinkControl",
    }.get(requested_role.lower().replace(" ", ""), "Control")

    control_class = getattr(uia, control_type, uia.Control)
    root = uia.GetRootControl()
    if query["app"]:
        found_window = uia.WindowControl(searchDepth=2, Name=query["app"])
        if found_window.Exists(0, 0):
            root = found_window

    results: list[Any] = []
    for control, _ in uia.WalkTree(root, maxDepth=10):
        try:
            name = str(control.Name or "")
            if query["text"].lower() in name.lower():
                results.append(control)
        except Exception:
            continue
    return results


def uiautomation_element_dict(item: Any) -> dict[str, Any]:
    rect = item.BoundingRectangle
    return {
        "id": str(getattr(item, "RuntimeId", "") or ""),
        "name": str(getattr(item, "Name", "") or ""),
        "controlType": str(getattr(item, "ControlTypeName", "") or "").replace("Control", ""),
        "x": int(rect.left if rect else 0),
        "y": int(rect.top if rect else 0),
        "width": int(rect.width() if rect else 0),
        "height": int(rect.height() if rect else 0),
        "centerX": int((rect.left + rect.right) / 2 if rect else 0),
        "centerY": int((rect.top + rect.bottom) / 2 if rect else 0),
        "isEnabled": bool(getattr(item, "IsEnabled", True)),
        "isVisible": bool(not getattr(item, "IsOffscreen", False)),
        "isSelected": bool(getattr(item, "IsSelected", False)) if hasattr(item, "IsSelected") else False,
    }


def uiautomation_execute(operation: str, action: dict[str, Any]) -> Any:
    import uiautomation as uia  # type: ignore

    if operation == "list":
        return {"elements": [uiautomation_element_dict(item) for item in uiautomation_find(action)[:200]]}
    deadline = time.monotonic() + selector(action)["timeout"]
    matches = uiautomation_find(action)
    while not matches and operation == "wait" and time.monotonic() < deadline:
        time.sleep(0.2)
        matches = uiautomation_find(action)
    if not matches:
        raise LookupError("No matching uiautomation element was found.")
    item = matches[0]
    if operation in {"find", "state", "wait"}:
        return uiautomation_element_dict(item)
    if operation == "value":
        result = uiautomation_element_dict(item)
        result["value"] = str(getattr(item, "GetValuePattern", lambda: None)() or item.Name or "")
        result["valueLength"] = len(result["value"])
        return result
    if operation in {"invoke", "click"}:
        if hasattr(item, "GetInvokePattern") and item.GetInvokePattern():
            item.GetInvokePattern().Invoke()
        else:
            item.Click()
    elif operation == "focus":
        item.SetFocus()
    elif operation == "toggle":
        if hasattr(item, "GetTogglePattern") and item.GetTogglePattern():
            item.GetTogglePattern().Toggle()
        else:
            item.Click()
    elif operation == "expand":
        if hasattr(item, "GetExpandCollapsePattern") and item.GetExpandCollapsePattern():
            item.GetExpandCollapsePattern().Expand()
    elif operation == "collapse":
        if hasattr(item, "GetExpandCollapsePattern") and item.GetExpandCollapsePattern():
            item.GetExpandCollapsePattern().Collapse()
    elif operation == "select":
        if hasattr(item, "GetSelectionItemPattern") and item.GetSelectionItemPattern():
            item.GetSelectionItemPattern().Select()
        else:
            item.Click()
    elif operation in {"setValue", "type"}:
        val = str(action.get("value") or action.get("textToSet") or action.get("textToType") or action.get("input") or action.get("content") or "")
        if hasattr(item, "GetValuePattern") and item.GetValuePattern() and hasattr(item.GetValuePattern(), "SetValue"):
            item.GetValuePattern().SetValue(val)
        else:
            item.SendKeys(val)
    elif operation == "scroll":
        direction = str(action.get("direction") or "down").lower()
        if hasattr(item, "GetScrollPattern") and item.GetScrollPattern():
            pat = item.GetScrollPattern()
            if direction == "up":
                pat.Scroll(uia.ScrollAmount.NoAmount, uia.ScrollAmount.LargeDecrement)
            elif direction == "down":
                pat.Scroll(uia.ScrollAmount.NoAmount, uia.ScrollAmount.LargeIncrement)
        else:
            item.WheelDown() if direction == "down" else item.WheelUp()
    elif operation == "shortcut":
        keys = str(action.get("keys") or action.get("shortcut") or "")
        item.SetFocus()
        item.SendKeys(keys)
    else:
        raise ValueError(f"Unsupported uiautomation operation: {operation}")
    return uiautomation_element_dict(item)


def main() -> None:
    try:
        request = json.load(sys.stdin)
        provider = request.get("provider")
        operation = request.get("operation")
        action = request.get("action") or {}
        if provider == "diagnostics" or operation == "diagnostics":
            print(json.dumps({"ok": True, "data": {
                "touchpoint": importlib.util.find_spec("touchpoint") is not None,
                "pywinauto": importlib.util.find_spec("pywinauto") is not None,
                "uiautomation": importlib.util.find_spec("uiautomation") is not None,
                "davinci": importlib.util.find_spec("DaVinciResolveScript") is not None or importlib.util.find_spec("fusionscript") is not None,
            }}))
            return
        if provider == "davinci_auto_subs" or operation == "davinci_auto_subs":
            from davinci_resolve_autosubs import handle_autosubs_command
            data = handle_autosubs_command(action)
        elif provider == "touchpoint":
            data = touchpoint_execute(operation, action)
        elif provider == "pywinauto":
            data = pywinauto_execute(operation, action)
        elif provider == "uiautomation":
            data = uiautomation_execute(operation, action)
        else:
            raise ValueError("Unsupported Python accessibility provider.")
        print(json.dumps({"ok": True, "data": data}, default=str))
    except Exception as error:  # Host errors become structured provider failures.
        print(json.dumps({"ok": False, "error": str(error)}))


if __name__ == "__main__":
    main()

