.PHONY: run test webhook-info webhook-set webhook-delete

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest

webhook-info:
	python -m app.tasks.set_webhook info

webhook-set:
	@echo "Usage: make webhook-set WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook"
	@if [ -z "$(WEBHOOK_URL)" ]; then \
		echo "Error: WEBHOOK_URL is required"; \
		echo "Example: make webhook-set WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook"; \
		exit 1; \
	fi
	python -m app.tasks.set_webhook set $(WEBHOOK_URL)

webhook-delete:
	python -m app.tasks.set_webhook delete
