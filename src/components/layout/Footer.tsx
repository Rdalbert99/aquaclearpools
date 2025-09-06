import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/lovable-uploads/ac1a09a4-823e-491c-bf59-fb76c8abb196.png" 
                alt="Aqua Clear Pools" 
                className="h-12 w-12 object-contain"
              />
              <span className="font-bold text-lg">Aqua Clear Pools</span>
            </div>
            <p className="text-sm opacity-80">
              Professional pool maintenance, chemical balancing, and cleaning services in the Hattiesburg, Mississippi area.
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Contact Us</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <a href="tel:601-447-0399" className="hover:underline">
                  (601) 447-0399
                </a>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <a href="mailto:info@aquaclearpools.com" className="hover:underline">
                  info@aquaclearpools.com
                </a>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Hattiesburg, Mississippi</span>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Business Hours</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Mon-Fri: 8AM-6PM</span>
              </div>
              <div className="pl-6 opacity-80">Saturday: 9AM-4PM</div>
              <div className="pl-6 opacity-80">Sunday: Emergency only</div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <Link to="/contact" className="block hover:underline">
                Contact Us
              </Link>
              <Link to="/auth/client-signup" className="block hover:underline">
                New Customer Signup
              </Link>
              <Link to="/auth/login" className="block hover:underline">
                Customer Login
              </Link>
              <a href="tel:601-447-0399" className="block hover:underline">
                Emergency Service
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-secondary-foreground/20 mt-12 pt-8 text-center text-sm opacity-80">
          <p className="mb-2">&copy; 2024 Aqua Clear Pools. All rights reserved. Professional pool services in Hattiesburg, Mississippi.</p>
          <div className="flex justify-center items-center space-x-4 text-xs">
            <Link to="/privacy" className="hover:underline focus:underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:underline focus:underline">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;