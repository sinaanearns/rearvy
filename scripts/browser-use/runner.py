import asyncio
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

# Load environment variables from .env.local in the root if it exists
# Check current directory first, then parent directories up to the workspace root
def load_env_file():
    current = Path.cwd()
    for _ in range(5):  # Check up to 5 levels up
        env_path = current / ".env.local"
        if env_path.exists():
            load_dotenv(env_path)
            return
        parent = current.parent
        if parent == current:  # Reached filesystem root
            break
        current = parent
    
    # Fallback to loading from current directory
    load_dotenv()

load_env_file()


def extract_history_summary(history):
    summary = ""
    if hasattr(history, 'final_result'):
        try:
            summary = history.final_result()
        except Exception:
            summary = str(history) if history else ""
    elif isinstance(history, (list, tuple)) and len(history) > 0:
        last_action = history[-1]
        if hasattr(last_action, 'result'):
            summary = str(last_action.result)
        elif hasattr(last_action, 'extracted_content'):
            summary = str(last_action.extracted_content)
        else:
            summary = str(last_action)
    else:
        summary = str(history) if history else ""

    if not summary or summary.strip() == "":
        summary = "Browser task completed successfully"
    return summary


def command_to_instruction(raw, parsed):
    if isinstance(parsed, dict):
        commands = parsed.get("commands")
        if isinstance(commands, list) and commands:
            steps = []
            for cmd in commands:
                if not isinstance(cmd, dict):
                    continue
                action = str(cmd.get("action", "")).strip().lower()
                if action == "goto":
                    target = str(cmd.get("target", "")).strip()
                    if target:
                        steps.append(f"navigate to {target}")
                elif action == "click":
                    selector = str(cmd.get("selector", "")).strip()
                    x = cmd.get("x")
                    y = cmd.get("y")
                    if selector:
                        steps.append(f"click the element matching selector '{selector}'")
                    elif x is not None and y is not None:
                        steps.append(f"click at screen coordinates ({x}, {y})")
                    else:
                        steps.append("click the intended next interactive element")
                elif action == "typefocused":
                    value = str(cmd.get("value", ""))
                    if value:
                        steps.append(f"type this text into the currently focused field: {value}")
                elif action == "type":
                    value = str(cmd.get("value", ""))
                    selector = str(cmd.get("selector", "")).strip()
                    if value and selector:
                        steps.append(f"type '{value}' into selector '{selector}'")
                    elif value:
                        steps.append(f"type this text in the appropriate field: {value}")
                elif action in ("back", "forward", "reload"):
                    steps.append(f"perform browser action: {action}")
                elif action == "scroll":
                    amount = cmd.get("amount")
                    if amount is not None:
                        steps.append(f"scroll vertically by {amount} pixels")
                    else:
                        steps.append("scroll the page")

            if steps:
                return "Continue in the same browser tab and do the following in order: " + "; then ".join(steps) + "."

        cmd_value = parsed.get("cmd") or parsed.get("command")
        if isinstance(cmd_value, str) and cmd_value.strip():
            return cmd_value.strip()

    if isinstance(raw, str) and raw.strip():
        return raw.strip()

    return None

async def run_task(task_text, task_id=None, timeout_seconds=None):
    # Check for BROWSER_USE API key (browser-use.com managed service)
    browser_use_key = os.getenv("BROWSER_USE_API_KEY")
    if not browser_use_key:
        # Fallback message with setup instructions
        print(json.dumps({
            "ok": False, 
            "error": "Browser automation service not configured. Get BROWSER_USE_API_KEY from https://cloud.browser-use.com/new-api-key and set it in your environment.",
            "status": "unavailable",
            "id": task_id
        }))
        sys.stdout.flush()
        sys.exit(1)
    
    try:
        if timeout_seconds is None:
            timeout_ms = os.getenv("BROWSER_USE_TIMEOUT_MS", "45000")
            try:
                timeout_seconds = max(5, int(timeout_ms) // 1000)
            except ValueError:
                timeout_seconds = 45

        # Emit a started event so callers can observe immediate progress
        started = {"ok": True, "status": "initializing", "id": task_id, "message": "Initializing browser-use agent..."}
        print(json.dumps(started))
        sys.stdout.flush()

        # Import browser_use after checking for API keys
        from browser_use import Agent, Browser
        try:
            from langchain_openai import ChatOpenAI
        except ImportError:
            ChatOpenAI = None
        
        # Try to set up an external LLM provider to avoid browser-use's managed service
        fallback_llm = None
        
        browser_use_provider = os.getenv("BROWSER_USE_LLM_PROVIDER", "").strip().lower()
        browser_use_model = os.getenv("BROWSER_USE_MODEL", "").strip()
        nvidia_api_key = os.getenv("NVIDIA_API_KEY", "").strip()
        
        # Try NVIDIA via OpenAI-compatible endpoint as fallback
        if browser_use_provider == "nvidia" and nvidia_api_key and ChatOpenAI:
            try:
                fallback_llm = ChatOpenAI(
                    model=browser_use_model or "meta/llama-2-7b-chat",
                    api_key=nvidia_api_key,
                    base_url="https://integrate.api.nvidia.com/v1",
                    temperature=0.3
                )
            except Exception as e:
                print(json.dumps({
                    "ok": False,
                    "error": f"Failed to initialize Nvidia ChatOpenAI: {str(e)}",
                    "status": "llm_init_failed",
                    "id": task_id
                }))
                sys.stdout.flush()
                sys.exit(1)
        
        browser = None

        # Create agent with fallback LLM if available
        try:
            browser = Browser(keep_alive=True)
            await browser.start()

            if fallback_llm:
                agent = Agent(task=task_text, fallback_llm=fallback_llm, browser_session=browser)
            else:
                agent = Agent(task=task_text, browser_session=browser)
            
            print(json.dumps({"ok": True, "status": "agent_ready", "id": task_id, "message": "Agent initialized. Running task..."}))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({
                "ok": False,
                "error": f"Failed to create Agent: {str(e)}",
                "status": "agent_creation_failed",
                "id": task_id
            }))
            sys.stdout.flush()
            if browser:
                try:
                    await browser.kill()
                except Exception:
                    pass
            sys.exit(1)
        
        # Run the agent with timeout
        try:
            history = await asyncio.wait_for(agent.run(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            print(json.dumps({
                "ok": False,
                "error": f"Browser task exceeded {timeout_seconds}-second timeout",
                "status": "timeout",
                "id": task_id
            }))
            sys.stdout.flush()
            sys.exit(1)
        
        # Extract final result from history
        summary = extract_history_summary(history)

        # Determine if caller requested the browser to stay open after the task
        env_keep = os.getenv("BROWSER_KEEP_OPEN", "").strip()
        looks_like_open = False
        try:
            tlower = task_text.lower() if task_text and isinstance(task_text, str) else ""
            if any(k in tlower for k in ["open ", "visit ", "go to ", "navigate "]):
                looks_like_open = True
        except Exception:
            looks_like_open = False

        keep_open = env_keep not in ("0", "false", "no") or looks_like_open

        # If keep_open is requested, inform the caller and wait for an explicit close command on stdin.
        if keep_open:
            print(json.dumps({
                "ok": True,
                "summary": summary,
                "status": "running",
                "keep_open": True,
                "id": task_id
            }))
            sys.stdout.flush()

            # Wait for a simple command loop on stdin using non-blocking async I/O.
            # Use asyncio to read stdin without blocking the event loop.
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()
            
            try:
                while True:
                    # Non-blocking stdin read with timeout
                    try:
                        raw = await asyncio.wait_for(
                            loop.run_in_executor(None, sys.stdin.readline),
                            timeout=0.5
                        )
                    except asyncio.TimeoutError:
                        # No input available, keep listening
                        await asyncio.sleep(0.1)
                        continue
                    
                    if raw is None:
                        await asyncio.sleep(0.5)
                        continue
                    
                    raw = raw.strip()
                    if not raw:
                        await asyncio.sleep(0.2)
                        continue
                    
                    parsed = None
                    try:
                        parsed = json.loads(raw)
                    except Exception:
                        parsed = None

                    cmd = None
                    if isinstance(parsed, dict):
                        cmd = parsed.get("cmd") or parsed.get("command")
                    if cmd is None:
                        cmd = raw

                    if isinstance(cmd, str) and cmd.strip().lower() in ("close", "exit", "quit", "stop"):
                        if browser:
                            try:
                                await browser.kill()
                            except Exception:
                                pass
                        print(json.dumps({"ok": True, "status": "closed", "id": task_id}))
                        sys.stdout.flush()
                        break
                    else:
                        instruction = command_to_instruction(raw, parsed)
                        if not instruction:
                            print(json.dumps({"ok": False, "error": "unknown_command", "received": raw}))
                            sys.stdout.flush()
                            continue

                        print(json.dumps({
                            "ok": True,
                            "status": "processing_command",
                            "instruction": instruction,
                            "message": f"Executing command: {instruction}",
                            "id": task_id,
                        }))
                        sys.stdout.flush()

                        try:
                            if fallback_llm:
                                follow_up_agent = Agent(
                                    task=instruction,
                                    fallback_llm=fallback_llm,
                                    browser_session=browser,
                                )
                            else:
                                follow_up_agent = Agent(
                                    task=instruction,
                                    browser_session=browser,
                                )

                            follow_history = await asyncio.wait_for(
                                follow_up_agent.run(), timeout=timeout_seconds
                            )
                            follow_summary = extract_history_summary(follow_history)

                            print(json.dumps({
                                "ok": True,
                                "status": "running",
                                "summary": follow_summary,
                                "id": task_id,
                            }))
                            sys.stdout.flush()
                        except asyncio.TimeoutError:
                            print(json.dumps({
                                "ok": False,
                                "error": f"Follow-up browser command exceeded {timeout_seconds}-second timeout",
                                "status": "timeout",
                                "id": task_id,
                            }))
                            sys.stdout.flush()
                        except Exception as command_error:
                            import traceback
                            print(json.dumps({
                                "ok": False,
                                "error": str(command_error),
                                "status": "failed",
                                "id": task_id,
                                "traceback": traceback.format_exc(),
                            }))
                            sys.stdout.flush()
                        continue
            except Exception:
                # If anything goes wrong in the keep-open loop, just exit gracefully
                if browser:
                    try:
                        await browser.kill()
                    except Exception:
                        pass
                print(json.dumps({"ok": True, "status": "closed", "id": task_id}))
                sys.stdout.flush()
        else:
            if browser:
                try:
                    await browser.kill()
                except Exception:
                    pass
            print(json.dumps({
                "ok": True,
                "summary": summary,
                "status": "completed",
                "id": task_id
            }))
            sys.stdout.flush()
        
    except ImportError as e:
        if 'browser' in locals() and browser:
            try:
                await browser.kill()
            except Exception:
                pass
        print(json.dumps({
            "ok": False,
            "error": f"Failed to import browser-use: {str(e)}",
            "status": "failed",
            "id": task_id
        }))
        sys.stdout.flush()
        sys.exit(1)
    except Exception as e:
        import traceback
        if 'browser' in locals() and browser:
            try:
                await browser.kill()
            except Exception:
                pass
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "status": "failed",
            "id": task_id
        }))
        sys.stdout.flush()
        # Exit non-zero so spawn callers can detect failures by exit code if desired
        sys.exit(1)

if __name__ == "__main__":
    task = None
    task_id = None
    if len(sys.argv) > 1:
        # If argv provided, treat first arg as the raw task text
        task = sys.argv[1]
    else:
        # Read from stdin; accept plain text or JSON with {"task": "...", "id": "..."}
        try:
            input_data = sys.stdin.read().strip()
            if not input_data:
                print(json.dumps({"ok": False, "error": "No task provided.", "status": "failed"}))
                sys.exit(1)

            try:
                parsed = json.loads(input_data)
                if isinstance(parsed, dict) and "task" in parsed:
                    task = parsed.get("task")
                    task_id = parsed.get("id")
                else:
                    # Fallback to using the raw string input
                    task = input_data
            except Exception:
                task = input_data
        except EOFError:
            print(json.dumps({"ok": False, "error": "No task provided.", "status": "failed"}))
            sys.exit(1)

    asyncio.run(run_task(task, task_id=task_id))
