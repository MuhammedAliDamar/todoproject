export function LandingFooter() {
  return (
    <footer className="footer">
      <div className="page">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="brand" href="#">
              <span className="brand-mark"></span>
              marktasks
            </a>
            <p>The calm project tracker for fast-moving teams.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#">Boards</a></li>
              <li><a href="#">Timeline</a></li>
              <li><a href="#">Docs</a></li>
              <li><a href="#">Automations</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Changelog</a></li>
              <li><a href="#">Help center</a></li>
              <li><a href="#">API</a></li>
              <li><a href="#">Status</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Customers</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Press</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Security</a></li>
              <li><a href="#">DPA</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} marktasks, Inc.</span>
          <div className="footer-bottom-right">
            <a href="#">EN</a>
            <a href="#">v1.0.0</a>
            <a href="#">All systems normal</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
