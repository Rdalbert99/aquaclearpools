import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/BrandLogo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404: no page at", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Helmet>
        <title>Page not found | Aqua Clear Pools</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="text-center max-w-md">
        <BrandLogo className="mx-auto mb-6 h-20 w-20 object-contain" alt="Aqua Clear Pools" />
        <h1 className="text-4xl font-bold text-foreground mb-3">Page not found</h1>
        <p className="text-muted-foreground mb-6">
          We couldn't find that page. It may have moved, or the link may be mistyped.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild><Link to="/">Back to home</Link></Button>
          <Button asChild variant="outline"><Link to="/contact">Contact us</Link></Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
