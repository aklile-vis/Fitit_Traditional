ALTER TABLE "buyer_selections" ADD COLUMN "basePrice" REAL NOT NULL DEFAULT 0;
ALTER TABLE "buyer_selections" ADD COLUMN "addonTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "buyer_selections" ADD COLUMN "lineItems" TEXT;
ALTER TABLE "buyer_selections" ADD COLUMN "clientPrice" REAL;
ALTER TABLE "buyer_selections" ADD COLUMN "priceDifference" REAL;
