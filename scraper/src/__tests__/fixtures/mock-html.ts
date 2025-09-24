/**
 * Mock HTML fixtures for testing data extraction functions
 */

export const mockNavigationHTML = `
<nav role="navigation" class="main-nav">
  <a href="/fiction">Fiction</a>
  <a href="/non-fiction">Non-Fiction</a>
  <a href="/childrens">Children's Books</a>
  <a href="/textbooks">Textbooks</a>
  <a href="/my-account">My Account</a>
  <a href="/contact">Contact Us</a>
</nav>
`;

export const mockCategoryHTML = `
<div class="category-list">
  <a href="/fiction/sci-fi" class="category-item">
    <h3>Science Fiction</h3>
    <span class="product-count">150 books</span>
  </a>
  <a href="/fiction/fantasy" class="category-item">
    <h3>Fantasy</h3>
    <span class="product-count">200 books</span>
  </a>
  <a href="/fiction/mystery" class="category-item">
    <h3>Mystery</h3>
    <span class="product-count">75 books</span>
  </a>
</div>
`;

export const mockProductListHTML = `
<div class="product-grid">
  <div class="product-item">
    <a href="/product/dune-123" class="product-title">
      <h3>Dune</h3>
    </a>
    <img src="/images/dune.jpg" alt="Dune" />
    <div class="price">£15.99</div>
  </div>
  <div class="product-item">
    <a href="/product/foundation-456" class="product-title">
      <h3>Foundation</h3>
    </a>
    <img src="/images/foundation.jpg" alt="Foundation" />
    <div class="price">£12.50</div>
  </div>
  <div class="product-item">
    <a href="/product/free-book-789" class="product-title">
      <h3>Free Programming Book</h3>
    </a>
    <img src="/images/free-book.jpg" alt="Free Book" />
    <div class="price">Free</div>
  </div>
</div>
<div class="pagination">
  <a href="/category/sci-fi?page=2" class="next">Next</a>
</div>
`;

export const mockProductDetailHTML = `
<div class="product-page">
  <h1 class="product-title">The Hobbit: An Unexpected Journey</h1>
  
  <div class="product-images">
    <img src="/images/hobbit-main.jpg" alt="The Hobbit" />
    <img src="/images/hobbit-back.jpg" alt="The Hobbit Back Cover" />
  </div>
  
  <div class="price">£12.99</div>
  
  <div class="product-description">
    <p>A classic fantasy adventure novel by J.R.R. Tolkien. Follow Bilbo Baggins on his unexpected journey to the Lonely Mountain.</p>
  </div>
  
  <div class="product-specs">
    <table>
      <tr>
        <td>Author</td>
        <td>J.R.R. Tolkien</td>
      </tr>
      <tr>
        <td>ISBN</td>
        <td>978-0547928227</td>
      </tr>
      <tr>
        <td>Publisher</td>
        <td>Houghton Mifflin Harcourt</td>
      </tr>
      <tr>
        <td>Pages</td>
        <td>366</td>
      </tr>
      <tr>
        <td>Language</td>
        <td>English</td>
      </tr>
      <tr>
        <td>Format</td>
        <td>Paperback</td>
      </tr>
    </table>
  </div>
  
  <div class="availability">In Stock</div>
</div>
`;

export const mockOutOfStockProductHTML = `
<div class="product-page">
  <h1 class="product-title">Rare Collector's Edition</h1>
  <div class="price">£99.99</div>
  <div class="availability">Out of Stock</div>
  <div class="product-description">
    <p>A rare collector's edition that is currently unavailable.</p>
  </div>
</div>
`;

export const mockEmptyProductListHTML = `
<div class="product-grid">
  <!-- No products found -->
</div>
<div class="pagination">
  <!-- No pagination -->
</div>
`;

export const mockPaginationHTML = `
<div class="product-grid">
  <div class="product-item">
    <a href="/product/book-1" class="product-title">
      <h3>Book 1</h3>
    </a>
    <div class="price">£10.00</div>
  </div>
</div>
<div class="pagination">
  <a href="/category/books?page=1" class="prev disabled">Previous</a>
  <span class="current">1</span>
  <a href="/category/books?page=2" class="next">Next</a>
</div>
`;

export const mockNoPaginationHTML = `
<div class="product-grid">
  <div class="product-item">
    <a href="/product/only-book" class="product-title">
      <h3>Only Book</h3>
    </a>
    <div class="price">£5.00</div>
  </div>
</div>
<div class="pagination">
  <span class="current">1</span>
  <a href="#" class="next disabled">Next</a>
</div>
`;