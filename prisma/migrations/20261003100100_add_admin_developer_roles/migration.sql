-- Retain legacy enum values and account roles for historical compatibility.
ALTER TYPE "AdminRole" ADD VALUE 'ADMIN';
ALTER TYPE "AdminRole" ADD VALUE 'DEVELOPER';
