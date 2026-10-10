import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404: rota inexistente:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="mb-4 font-pixel text-4xl text-primary text-glow-green">404</h1>
        <p className="mb-6 font-game text-lg text-muted-foreground">Essa página não existe no mundo do Mine Fruits.</p>
        <Link
          to="/"
          className="font-pixel text-xs px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          ← Voltar ao jogo
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
