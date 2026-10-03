# Migrations

One history, merged from the two folders the Express backend had:

| Migration | Where it came from |
| --- | --- |
| `20260622092625_add_user_name` | `api/src/db/code/migrations`. Despite its name it is the baseline: it creates every table. Unchanged, so databases that already ran it still match. |
| `20260629101035_add_airline_fields` | `api/src/db/code/migrations`, unchanged. |
| `20261003120000_seed_currencies` | New. Carries over the currency rows that only the older `api/src/db/migrations` folder inserted. |

The older folder (`init_db`, `add_currency_table`, and a small `add_user_name`)
is not copied: the baseline above produces the same tables in one step, and no
database was built from it.

Apply with `npm run db:deploy`.
