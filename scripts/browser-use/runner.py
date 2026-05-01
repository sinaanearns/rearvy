import asyncio
import os
import sys
import json
from dotenv import load_dotenv
from browser_use import Agent
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

# Load environment variables from .env.local in the root if it exists
root_env = os.path.join(os.getcwd(), '.env.local')
if os.path.exists(root_env):
    load_dotenv(root_env)
else:
    load_dotenv()

async def run_task(task_text, task_id=None):
    # Choose LLM based on available keys
    if os.getenv("OPENAI_API_KEY"):
        llm = ChatOpenAI(model="gpt-4o")
    elif os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp")
    else:
        print(json.dumps({"ok": False, "error": "No API key found for OpenAI or Google.", "status": "failed", "id": task_id}))
        sys.stdout.flush()
        sys.exit(1)

    agent = Agent(
        task=task_text,
        llm=llm,
    )
    
    try:
        # Emit a started event so callers can observe immediate progress
        started = {"ok": True, "status": "started", "id": task_id}
        print(json.dumps(started))
        sys.stdout.flush()

        result = await agent.run()
        # Extract the final result summary
        summary = result.final_result() if hasattr(result, 'final_result') else str(result)

        print(json.dumps({
            "ok": True,
            "summary": summary,
            "status": "completed",
            "id": task_id
        }))
        sys.stdout.flush()
    except Exception as e:
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
