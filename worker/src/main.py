from bullmq import Worker
import asyncio
import signal
import os
from pwWorker import pw_worker

async def process(job, job_token):
    """ジョブを処理する"""
    job_data = job.data
    #worker_type = job_data.get('type', 'playwright')
    
    return await pw_worker(job_data)

async def main():

    # Create an event that will be triggered for shutdown
    shutdown_event = asyncio.Event()

    def signal_handler(sig, frame):
        print("Signal received, shutting down.")
        shutdown_event.set()

    # Assign signal handlers to SIGTERM and SIGINT
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Redis接続設定（認証情報を含める）
    redis_password = os.getenv('REDIS_PASSWORD', 'pengovr-password')
    redis_host = os.getenv('REDIS_HOST', 'localhost')
    redis_port = int(os.getenv('REDIS_PORT', '6379'))
    
    connection_string = f"redis://:{redis_password}@{redis_host}:{redis_port}"
    
    worker = Worker(
        "scraping-tasks", 
        process, 
        {
            "connection": connection_string,
            "concurrency": 1  # 1つのタスクを順番に処理
        }
    )

    # Wait until the shutdown event is set
    await shutdown_event.wait()

    # close the worker
    print("Cleaning up worker...")
    await worker.close()
    print("Worker shut down successfully.")

if __name__ == "__main__":
    asyncio.run(main())
