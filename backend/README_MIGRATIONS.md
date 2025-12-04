# Database Migrations

This project uses Alembic for database schema migrations.

## Running Migrations

Apply all pending migrations to bring your database up to date:

```bash
alembic upgrade head
```

## Creating New Migrations

After modifying SQLAlchemy models, generate a new migration:

```bash
alembic revision --autogenerate -m "Description of changes"
```

Review the generated migration file in `alembic/versions/` before applying it.

## Checking Migration Status

View current migration status:

```bash
alembic current
```

View migration history:

```bash
alembic history --verbose
```

## Rollback

Downgrade to previous migration:

```bash
alembic downgrade -1
```

Downgrade to a specific revision:

```bash
alembic downgrade <revision_id>
```

## Important Notes

- Always run `alembic upgrade head` before starting the server
- Review auto-generated migrations carefully - they may need manual adjustments
- Never modify applied migrations - create new ones instead
- Database URL is automatically loaded from environment variables (DATABASE_URL)
