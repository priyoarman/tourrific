-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "user_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saved_at" TIMESTAMPTZ(6),
    "flight" JSONB NOT NULL,
    "hotel" JSONB NOT NULL,
    "stay" JSONB NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "city" TEXT,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "total_price" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL,
    "sample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trips_user_id_idx" ON "trips"("user_id");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
