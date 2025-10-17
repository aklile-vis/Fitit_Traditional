.PHONY: backend frontend setup prisma health cli-test

setup:
	cd backend && python3 -m pip install -r requirements.txt
	npm install

prisma:
	npm run db:generate
	npm run db:push

backend:
	npm run backend:dev

frontend:
	npm run frontend:dev

health:
	curl -s http://localhost:8000/health | jq . || curl -s http://localhost:8000/health

cli-test:
	python3 scripts/smoke_test.py || true
