export default function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="page-loader">
      <div className="page-loader__spinner" />
      <p>{label}</p>
    </div>
  );
}
