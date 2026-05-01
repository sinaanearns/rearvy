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

async def run_task(task_text, task_id=None, timeout_seconds=40):
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
        # Emit a started event so callers can observe immediate progress
        started = {"ok": True, "status": "started", "id": task_id}
        print(json.dumps(started))
        sys.stdout.flush()

        # Import browser_use after checking for API keys
        from browser_use import Agent
        
        # Set NVIDIA config for browser-use
        os.environ["BROWSER_USE_API_KEY"] = nvidia_api_key
        os.environ["BROWSER_USE_LLM_MODEL"] = "mistralai/ministral-14b-instruct-2512"
        os.environ["BROWSER_USE_LLM_PROVIDER_BASE_URL"] = "https://integrate.api.nvidia.com/v1"
        
        # Create agent without specifying llm - let it auto-initialize
        agent = Agent(task=task_text)
        
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
        summary = ""
        if hasattr(history, 'final_result'):
            try:
                summary = history.final_result()
            except:
                summary = str(history) if history else ""
        elif isinstance(history, (list, tuple)) and len(history) > 0:
            # Get the last action's result
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

        print(json.dumps({
            "ok": True,
            "summary": summary,
            "status": "completed",
            "id": task_id
        }))
        sys.stdout.flush()
        
    except ImportError as e:
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
