export default function PageHeader({ title, description, children }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {children && <div className="page-header__actions">{children}</div>}
    </header>
  );
}
