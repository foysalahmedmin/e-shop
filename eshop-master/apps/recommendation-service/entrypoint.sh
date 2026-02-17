#!/bin/sh
npx prisma generate
exec dumb-init node dist/main.js 