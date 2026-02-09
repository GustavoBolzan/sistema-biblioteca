;(() => {
  'use strict';

  const COVER_BASE = 'public/capadelivro/';
  const PLACEHOLDER = `${COVER_BASE}placeholder.svg`;
  const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=4F46E5&color=fff&size=128&name=';

  // ========== STORAGE ==========
  function saveTo(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log(` ${key} salvo:`, data.length, 'itens');
      return true;
    } catch (e) {
      console.error(' Erro ao salvar', key, e);
      alert('Erro ao salvar dados!');
      return false;
    }
  }

  function loadFrom(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error(' Erro ao carregar', key, e);
      return null;
    }
  }

  const saveUsers = (users) => saveTo('users', users);
  const getUsers = () => loadFrom('users') || [];
  const saveBooks = (books) => saveTo('books', books);
  const getBooks = () => loadFrom('books') || [];
  const saveCopies = (copies) => saveTo('copies', copies);
  const getCopies = () => loadFrom('copies') || [];
  const saveLoans = (loans) => saveTo('loans', loans);
  const getLoans = () => loadFrom('loans') || [];
  const saveReservations = (res) => saveTo('reservations', res);
  const getReservations = () => loadFrom('reservations') || [];
  const saveNotifications = (notifs) => saveTo('notifications', notifs);
  const getNotifications = () => loadFrom('notifications') || [];

  // ========== TEMA ESCURO ==========
  function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    return newTheme;
  }

  // ========== MODELS ==========
  function User(id, email, password, name, role, grade, avatar) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.name = name;
    this.role = role || 'student';
    this.grade = grade || null;
    this.avatar = avatar || DEFAULT_AVATAR + encodeURIComponent(name);
  }

  function normalizeCover(url) {
    if (!url) return PLACEHOLDER;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    if (url.startsWith('public/')) return url;
    return COVER_BASE + url;
  }

  function Book(id, title, author, publisher, year, genre, synopsis, type, coverUrl) {
    this.id = id;
    this.title = title;
    this.author = author;
    this.publisher = publisher;
    this.year = year;
    this.genre = genre;
    this.synopsis = synopsis;
    this.type = type || 'normal';
    this.coverUrl = normalizeCover(coverUrl);
  }

  function Copy(id, bookId, copyNumber, status) {
    this.id = id;
    this.bookId = bookId;
    this.copyNumber = copyNumber || 1;
    this.status = status || 'available';
  }

  function Loan(id, copyId, bookId, userId, loanDate, dueDate, status, returnDate, renewalCount) {
    this.id = id;
    this.copyId = copyId;
    this.bookId = bookId;
    this.userId = userId;
    this.loanDate = loanDate;
    this.dueDate = dueDate;
    this.status = status || 'active';
    this.returnDate = returnDate || null;
    this.renewalCount = renewalCount || 0;
  }

  function Reservation(id, bookId, userId, reservationDate, status) {
    this.id = id;
    this.bookId = bookId;
    this.userId = userId;
    this.reservationDate = reservationDate;
    this.status = status || 'pending';
  }

  function Notification(id, userId, type, message, read, createdAt) {
    this.id = id;
    this.userId = userId;
    this.type = type; // 'info', 'warning', 'success', 'danger'
    this.message = message;
    this.read = read || false;
    this.createdAt = createdAt || Date.now();
  }

  // ========== NOTIFICAÇÕES ==========
  function createNotification(userId, type, message) {
    const notifications = getNotifications();
    const notif = new Notification('n' + Date.now(), userId, type, message, false);
    notifications.push(notif);
    saveNotifications(notifications);
    return notif;
  }

  function getUserNotifications(userId, unreadOnly = false) {
    const notifications = getNotifications();
    let userNotifs = notifications.filter(n => n.userId === userId);
    if (unreadOnly) {
      userNotifs = userNotifs.filter(n => !n.read);
    }
    return userNotifs.sort((a, b) => b.createdAt - a.createdAt);
  }

  function markNotificationAsRead(notificationId) {
    const notifications = getNotifications();
    const notif = notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.read = true;
      saveNotifications(notifications);
    }
  }

  function markAllNotificationsAsRead(userId) {
    const notifications = getNotifications();
    notifications.forEach(n => {
      if (n.userId === userId) n.read = true;
    });
    saveNotifications(notifications);
  }

  // Simular envio de email (log no console)
  function sendEmail(to, subject, body) {
    console.log(' EMAIL ENVIADO:');
    console.log('Para:', to);
    console.log('Assunto:', subject);
    console.log('Mensagem:', body);
    console.log('---');
  }

  // ========== RECOMENDAÇÕES ==========
  function getRecommendations(userId, limit = 5) {
    const user = getUserById(userId);
    if (!user) return [];

    const loans = getLoans().filter(l => l.userId === userId);
    if (loans.length === 0) {
      // Usuário novo - recomendar livros populares
      return getTopBorrowedBooks(limit).map(item => item.book);
    }

    // Análise de gêneros lidos
    const genreCounts = {};
    loans.forEach(loan => {
      const book = getBookById(loan.bookId);
      if (book) {
        genreCounts[book.genre] = (genreCounts[book.genre] || 0) + 1;
      }
    });

    // Ordenar gêneros por frequência
    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre);

    // Livros já lidos
    const readBookIds = new Set(loans.map(l => l.bookId));

    // Buscar livros dos gêneros favoritos que ainda não foram lidos
    const allBooks = getBooks();
    const recommendations = [];

    for (const genre of sortedGenres) {
      const booksInGenre = allBooks.filter(b => 
        b.genre === genre && 
        !readBookIds.has(b.id) &&
        getAvailableCopiesCount(b.id) > 0
      );
      recommendations.push(...booksInGenre);
      if (recommendations.length >= limit) break;
    }

    // Se não tiver suficientes, adicionar outros livros disponíveis
    if (recommendations.length < limit) {
      const otherBooks = allBooks.filter(b => 
        !readBookIds.has(b.id) &&
        !recommendations.find(r => r.id === b.id) &&
        getAvailableCopiesCount(b.id) > 0
      );
      recommendations.push(...otherBooks);
    }

    return recommendations.slice(0, limit);
  }

  // ========== USER SESSION ==========
  function setCurrentUser(user, remember) {
    if (!user) {
      sessionStorage.removeItem('currentUser');
      localStorage.removeItem('currentUser');
      return;
    }
    const json = JSON.stringify(user);
    if (remember) {
      localStorage.setItem('currentUser', json);
    } else {
      sessionStorage.setItem('currentUser', json);
    }
  }

  function getCurrentUser() {
    let data = sessionStorage.getItem('currentUser');
    if (data) return JSON.parse(data);
    data = localStorage.getItem('currentUser');
    if (data) return JSON.parse(data);
    return null;
  }

  function updateUserProfile(userId, updates) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      Object.assign(user, updates);
      saveUsers(users);
      
      // Atualizar sessão se for o usuário atual
      const current = getCurrentUser();
      if (current && current.id === userId) {
        const remember = !!localStorage.getItem('currentUser');
        setCurrentUser(user, remember);
      }
      
      return { success: true, user };
    }
    return { success: false, message: 'Usuário não encontrado' };
  }

  // ========== SEED DATA ==========
  function initSystem() {
    const version = '4.0';
    if (localStorage.getItem('system_version') === version) {
      console.log('✅ Sistema já inicializado');
      return;
    }

    console.log('🚀 Inicializando sistema...');

    // Usuários
    if (getUsers().length === 0) {
      const users = [
        new User('u1', 'lara@escola.edu', 'senha123', 'Lara Goulart', 'student', '3º Ano CPG'),
        new User('u2', 'gustavo@escola.edu', 'senha123', 'Gustavo Bolzan', 'student', '3º Ano CPG'),
        new User('u3', 'maria@escola.edu', 'senha123', 'Maria Silva', 'student', '2º Ano TVC'),
        new User('u4', 'bibliotecario@escola.edu', 'bibliotecario123', 'Bibliotecário', 'librarian', null),
      ];
      saveUsers(users);
    }

    // Livros
    if (getBooks().length === 0) {
      const books = [
        new Book('b1', '1984', 'George Orwell', 'Companhia das Letras', 1949, 'Ficção Científica', 'Romance distópico sobre totalitarismo.', 'normal', '1984.jpg'),
        new Book('b2', 'Dom Casmurro', 'Machado de Assis', 'Garnier', 1899, 'Romance', 'História de Bentinho e Capitu.', 'normal', 'domcasmurro.jpg'),
        new Book('b3', 'O Senhor dos Anéis', 'J.R.R. Tolkien', 'Martins Fontes', 1954, 'Fantasia', 'Épica aventura na Terra Média.', 'normal', 'osenhordosaneis.jpg'),
        new Book('b4', 'Sapiens', 'Yuval Noah Harari', 'L&PM', 2011, 'Não-ficção', 'História da humanidade.', 'normal', 'sapiens.jpg'),
        new Book('b5', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'Programação', 'Guia de boas práticas de código.', 'consulta', 'cleancode.jpg'),
        new Book('b6', 'O Hobbit', 'J.R.R. Tolkien', 'Martins Fontes', 1937, 'Fantasia', 'A aventura de Bilbo Bolseiro.', 'normal', 'ohobbit.jpg'),
        new Book('b7', 'Harry Potter e a Pedra Filosofal', 'J.K. Rowling', 'Rocco', 1997, 'Fantasia', 'Um jovem bruxo descobre seu destino mágico.', 'normal', 'herrypotter.jpg'),
        new Book('b8', 'O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Agir', 1943, 'Infantil', 'Uma fábula poética sobre amor e amizade.', 'normal', 'opequenoprincepe.jpg'),
        new Book('b9', 'Cem Anos de Solidão', 'Gabriel García Márquez', 'Record', 1967, 'Romance', 'A saga da família Buendía em Macondo.', 'normal', 'cemanosdesolidao.jpg'),
        new Book('b10', 'O Código Da Vinci', 'Dan Brown', 'Sextante', 2003, 'Suspense', 'Um mistério envolvendo arte, história e religião.', 'normal', 'ocodigodavinci.jpg'),
        new Book('b11', 'A Culpa é das Estrelas', 'John Green', 'Intrínseca', 2012, 'Romance', 'Uma história de amor entre dois adolescentes com câncer.', 'normal', 'aculpaedasestrelas.jpg'),
        new Book('b12', 'O Alquimista', 'Paulo Coelho', 'Rocco', 1988, 'Ficção', 'A jornada de um pastor em busca de seu tesouro.', 'normal', 'oalquimista.jpg'),
        new Book('b13', 'A Revolução dos Bichos', 'George Orwell', 'Companhia das Letras', 1945, 'Ficção Científica', 'Uma alegoria sobre totalitarismo e poder.', 'normal', 'arevolucaodosbichos.jpg'),
        new Book('b14', 'O Cortiço', 'Aluísio Azevedo', 'Ática', 1890, 'Romance', 'Retrato da vida em um cortiço no Rio de Janeiro.', 'normal', 'ocortico.jpg'),
        new Book('b15', 'Memórias Póstumas de Brás Cubas', 'Machado de Assis', 'Nova Fronteira', 1881, 'Romance', 'Narrado por um defunto autor, uma obra-prima da literatura.', 'normal', 'memoriaspostumas.jpg'),
      ];
      saveBooks(books);

      // Cópias
      const copies = [];
      books.forEach((book, i) => {
        copies.push(new Copy(`c${i}_1`, book.id, 1, 'available'));
        copies.push(new Copy(`c${i}_2`, book.id, 2, 'available'));
      });
      saveCopies(copies);
    }

    if (getLoans().length === 0) saveLoans([]);
    if (getReservations().length === 0) saveReservations([]);
    if (getNotifications().length === 0) saveNotifications([]);

    localStorage.setItem('system_version', version);
    console.log('✅ Sistema inicializado!');
  }

  // ========== VERIFICAÇÃO AUTOMÁTICA DE NOTIFICAÇÕES ==========
  function checkAndCreateNotifications() {
    const loans = getLoans().filter(l => l.status === 'active');
    const now = Date.now();
    
    loans.forEach(loan => {
      const daysUntil = getDaysUntilDue(loan.dueDate);
      const user = getUserById(loan.userId);
      const book = getBookById(loan.bookId);
      
      if (!user || !book) return;
      
      // Notificar 2 dias antes do vencimento
      if (daysUntil === 2) {
        const existingNotif = getNotifications().find(n => 
          n.userId === user.id && 
          n.message.includes(book.title) && 
          n.message.includes('vence em 2 dias')
        );
        
        if (!existingNotif) {
          createNotification(
            user.id,
            'warning',
            `⏰ "${book.title}" vence em 2 dias! Devolva até ${formatDate(loan.dueDate)}.`
          );
          
          sendEmail(
            user.email,
            'Lembrete: Livro vence em breve',
            `Olá ${user.name},\n\nSeu empréstimo de "${book.title}" vence em 2 dias (${formatDate(loan.dueDate)}).\n\nPor favor, devolva o livro ou renove o empréstimo.\n\nAtenciosamente,\nBiblioteca Bráulio Franco`
          );
        }
      }
      
      // Notificar livros atrasados
      if (daysUntil < 0) {
        const daysLate = Math.abs(daysUntil);
        const existingNotif = getNotifications().find(n => 
          n.userId === user.id && 
          n.message.includes(book.title) && 
          n.message.includes('atrasado')
        );
        
        if (!existingNotif) {
          createNotification(
            user.id,
            'danger',
            `🚨 "${book.title}" está atrasado há ${daysLate} dia(s)! Devolva urgente.`
          );
          
          sendEmail(
            user.email,
            'URGENTE: Livro atrasado',
            `Olá ${user.name},\n\nSeu empréstimo de "${book.title}" está atrasado há ${daysLate} dia(s).\n\nPor favor, devolva o livro o mais rápido possível.\n\nAtenciosamente,\nBiblioteca Bráulio Franco`
          );
        }
      }
    });
    
    // Notificar reservas cumpridas
    const reservations = getReservations().filter(r => r.status === 'fulfilled');
    reservations.forEach(res => {
      const user = getUserById(res.userId);
      const book = getBookById(res.bookId);
      
      if (!user || !book) return;
      
      const existingNotif = getNotifications().find(n => 
        n.userId === user.id && 
        n.message.includes(book.title) && 
        n.message.includes('disponível')
      );
      
      if (!existingNotif) {
        createNotification(
          user.id,
          'success',
          `🎉 Sua reserva de "${book.title}" está disponível! Empreste agora.`
        );
        
        sendEmail(
          user.email,
          'Reserva disponível',
          `Olá ${user.name},\n\nSua reserva de "${book.title}" está disponível para empréstimo!\n\nVisite a biblioteca para retirar seu livro.\n\nAtenciosamente,\nBiblioteca Bráulio Franco`
        );
      }
    });
  }

  // ========== AUTH ==========
  function registerUser(name, email, password, role, grade, avatar) {
    const users = getUsers();
    if (!name || !email || !password) {
      return { success: false, message: 'Preencha todos os campos.' };
    }
    
    if (role === 'student' && !email.endsWith('@escola.edu')) {
      return { success: false, message: 'Use um email da escola (@escola.edu).' };
    }
    
    if (role === 'student' && !grade) {
      return { success: false, message: 'Informe sua série/turma.' };
    }
    
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: 'E-mail já cadastrado.' };
    }
    
    const user = new User('u' + Date.now(), email, password, name, role || 'student', grade, avatar);
    users.push(user);
    saveUsers(users);
    setCurrentUser(user, true);
    
    // Notificação de boas-vindas
    createNotification(
      user.id,
      'success',
      `🎉 Bem-vindo à Biblioteca Bráulio Franco, ${name}! Explore nosso catálogo de livros.`
    );
    
    return { success: true, user };
  }

  function login(email, password, remember) {
    const users = getUsers();
    const user = users.find(u => 
      u.email.toLowerCase() === email.toLowerCase() && 
      u.password === password
    );
    if (!user) return { success: false };
    setCurrentUser(user, remember);
    return { success: true, user };
  }

  function logout() {
    setCurrentUser(null);
    window.location.href = 'index.html';
  }

  // ========== BOOKS ==========
  const getBookById = (id) => getBooks().find(b => b.id === id);
  const getUserById = (id) => getUsers().find(u => u.id === id);
  const getAvailableCopiesCount = (bookId) => getCopies().filter(c => c.bookId === bookId && c.status === 'available').length;
  const getTotalCopiesCount = (bookId) => getCopies().filter(c => c.bookId === bookId).length;
  const findAvailableCopy = (bookId) => getCopies().find(c => c.bookId === bookId && c.status === 'available');

  function updateCopyStatus(copyId, status) {
    const copies = getCopies();
    const copy = copies.find(c => c.id === copyId);
    if (copy) {
      copy.status = status;
      saveCopies(copies);
    }
  }

  function searchBooks(query, filters = {}) {
    let books = getBooks();
    
    if (query && query.trim()) {
      const q = query.toLowerCase();
      books = books.filter(b => 
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }

    if (filters.genre && filters.genre !== 'all') {
      books = books.filter(b => b.genre === filters.genre);
    }
    if (filters.type && filters.type !== 'all') {
      books = books.filter(b => b.type === filters.type);
    }
    if (filters.year && filters.year !== 'all') {
      books = books.filter(b => b.year === parseInt(filters.year));
    }

    return books;
  }

  let debounceTimer;
  function debounceSearch(callback, delay = 300) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(callback, delay);
  }

  // ========== LOANS ==========
  function getLoanPeriodDays(bookType) {
    return bookType === 'consulta' ? 7 : 14;
  }

  function borrowBook(bookId) {
    const book = getBookById(bookId);
    if (!book) return { success: false, message: 'Livro não encontrado.' };

    const copy = findAvailableCopy(bookId);
    if (!copy) return { success: false, message: 'Nenhuma cópia disponível.' };

    updateCopyStatus(copy.id, 'borrowed');

    const loans = getLoans();
    const current = getCurrentUser();
    const loanDate = Date.now();
    const days = getLoanPeriodDays(book.type);
    const dueDate = loanDate + (days * 24 * 60 * 60 * 1000);

    const loan = new Loan(
      'l' + Date.now(),
      copy.id,
      bookId,
      current ? current.id : null,
      loanDate,
      dueDate,
      'active'
    );

    loans.push(loan);
    saveLoans(loans);
    
    // Criar notificação
    if (current) {
      createNotification(
        current.id,
        'success',
        `📚 Empréstimo confirmado: "${book.title}". Devolva até ${formatDate(dueDate)}.`
      );
      
      sendEmail(
        current.email,
        'Empréstimo confirmado',
        `Olá ${current.name},\n\nSeu empréstimo de "${book.title}" foi confirmado!\n\nData de devolução: ${formatDate(dueDate)}\n\nBoa leitura!\n\nAtenciosamente,\nBiblioteca Bráulio Franco`
      );
    }
    
    return { success: true, loan };
  }

  function returnBook(loanId) {
    const loans = getLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return { success: false, message: 'Empréstimo não encontrado.' };

    const returnDate = Date.now();
    const daysLate = Math.max(0, Math.floor((returnDate - loan.dueDate) / 86400000));

    loan.status = 'returned';
    loan.returnDate = returnDate;
    saveLoans(loans);

    updateCopyStatus(loan.copyId, 'available');
    
    // Criar notificação
    const user = getUserById(loan.userId);
    const book = getBookById(loan.bookId);
    
    if (user) {
      const message = daysLate > 0 
        ? `📖 "${book.title}" devolvido com ${daysLate} dia(s) de atraso.`
        : `📖 "${book.title}" devolvido no prazo. Obrigado!`;
      
      createNotification(user.id, daysLate > 0 ? 'warning' : 'success', message);
      
      sendEmail(
        user.email,
        'Devolução confirmada',
        `Olá ${user.name},\n\nSua devolução de "${book.title}" foi confirmada!\n\n${daysLate > 0 ? `Atenção: O livro foi devolvido com ${daysLate} dia(s) de atraso.` : 'Obrigado por devolver no prazo!'}\n\nAtenciosamente,\nBiblioteca Bráulio Franco`
      );
    }
    
    // Verificar reservas pendentes
    const reservations = getReservations();
    const pendingReservation = reservations.find(r => 
      r.bookId === loan.bookId && 
      r.status === 'pending'
    );
    
    if (pendingReservation) {
      pendingReservation.status = 'fulfilled';
      saveReservations(reservations);
      
      const reservationUser = getUserById(pendingReservation.userId);
      if (reservationUser) {
        createNotification(
          reservationUser.id,
          'success',
          `🎉 Sua reserva de "${book.title}" está disponível!`
        );
      }
    }

    const message = daysLate > 0 
      ? `Livro devolvido com ${daysLate} dia(s) de atraso.`
      : 'Livro devolvido com sucesso!';
    
    return { success: true, daysLate, message };
  }

  function renewLoan(loanId) {
    const loans = getLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return { success: false, message: 'Empréstimo não encontrado.' };
    if (loan.renewalCount >= 1) return { success: false, message: 'Já foi renovado.' };

    const book = getBookById(loan.bookId);
    const days = getLoanPeriodDays(book.type);
    loan.dueDate = loan.dueDate + (days * 24 * 60 * 60 * 1000);
    loan.renewalCount = (loan.renewalCount || 0) + 1;
    saveLoans(loans);
    
    // Criar notificação
    const user = getUserById(loan.userId);
    if (user) {
      createNotification(
        user.id,
        'info',
        `🔄 Empréstimo de "${book.title}" renovado. Nova data: ${formatDate(loan.dueDate)}.`
      );
      
      sendEmail(
        user.email,
        'Renovação confirmada',
        `Olá ${user.name},\n\nSeu empréstimo de "${book.title}" foi renovado com sucesso!\n\nNova data de devolução: ${formatDate(loan.dueDate)}\n\nAtenciosamente,\nBiblioteca Bráulio Franco`
      );
    }
    
    return { success: true };
  }

  // ========== UTILS ==========
  const formatDate = (ts) => new Date(ts).toLocaleDateString('pt-BR');
  const getDaysUntilDue = (dueDate) => Math.ceil((dueDate - Date.now()) / 86400000);
  const getOverdueLoans = () => getLoans().filter(l => l.status === 'active' && l.dueDate < Date.now());

  function getTopBorrowedBooks(limit = 5) {
    const loans = getLoans();
    const counts = {};
    loans.forEach(loan => {
      counts[loan.bookId] = (counts[loan.bookId] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([bookId, count]) => ({ book: getBookById(bookId), count }))
      .filter(item => item.book)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // ========== RESERVATIONS ==========
  function reserveBook(userId, bookId) {
    const reservations = getReservations();
    const exists = reservations.find(r => 
      r.userId === userId && 
      r.bookId === bookId && 
      r.status === 'pending'
    );
    if (exists) return { success: false, message: 'Você já tem reserva ativa deste livro.' };

    const reservation = new Reservation('r' + Date.now(), bookId, userId, Date.now(), 'pending');
    reservations.push(reservation);
    saveReservations(reservations);
    
    // Criar notificação
    const book = getBookById(bookId);
    const user = getUserById(userId);
    if (user && book) {
      createNotification(
        userId,
        'info',
        `📌 Reserva de "${book.title}" registrada. Você será notificado quando estiver disponível.`
      );
      
      sendEmail(
        user.email,
        'Reserva confirmada',
        `Olá ${user.name},\n\nSua reserva de "${book.title}" foi registrada com sucesso!\n\nVocê será notificado quando o livro estiver disponível.\n\nAtenciosamente,\nBiblioteca Bráulio Franco`
      );
    }
    
    return { success: true, reservation };
  }

  function cancelReservation(reservationId) {
    const reservations = getReservations();
    const reservation = reservations.find(r => r.id === reservationId);
    if (reservation) {
      reservation.status = 'cancelled';
      saveReservations(reservations);
      
      // Criar notificação
      const book = getBookById(reservation.bookId);
      createNotification(
        reservation.userId,
        'info',
        `❌ Reserva de "${book.title}" cancelada.`
      );
      
      return { success: true };
    }
    return { success: false };
  }

  function checkFulfilledReservations(userId) {
    const reservations = getReservations();
    return reservations
      .filter(r => r.userId === userId && r.status === 'fulfilled')
      .map(r => {
        const book = getBookById(r.bookId);
        return { type: 'success', message: `"${book.title}" está disponível!` };
      });
  }

  function checkUpcomingDueDates(userId) {
    const loans = getLoans();
    const activeLoans = loans.filter(l => l.userId === userId && l.status === 'active');
    const notifications = [];
    
    activeLoans.forEach(loan => {
      const daysUntil = getDaysUntilDue(loan.dueDate);
      const book = getBookById(loan.bookId);
      if (book) {
        if (daysUntil < 0) {
          notifications.push({
            type: 'danger',
            message: `"${book.title}" está atrasado há ${Math.abs(daysUntil)} dia(s)!`
          });
        } else if (daysUntil <= 2) {
          notifications.push({
            type: 'warning',
            message: `"${book.title}" vence em ${daysUntil} dia(s).`
          });
        }
      }
    });
    
    return notifications;
  }

  // ========== EXPORTS (CSV) ==========
  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportTopBorrowedBooks() {
    const topBooks = getTopBorrowedBooks(10);
    let csv = 'Posição,Título,Autor,Empréstimos\n';
    topBooks.forEach((item, i) => {
      csv += `${i+1},"${item.book.title}","${item.book.author}",${item.count}\n`;
    });
    downloadCSV(csv, 'top_livros.csv');
  }

  function exportOverdueLoans() {
    const loans = getOverdueLoans();
    let csv = 'Aluno,Email,Livro,Atraso (dias)\n';
    loans.forEach(loan => {
      const user = getUserById(loan.userId);
      const book = getBookById(loan.bookId);
      if (user && book) {
        const days = Math.abs(getDaysUntilDue(loan.dueDate));
        csv += `"${user.name}","${user.email}","${book.title}",${days}\n`;
      }
    });
    downloadCSV(csv, 'atrasados.csv');
  }

  function exportAllLoans() {
    const loans = getLoans();
    let csv = 'Aluno,Livro,Empréstimo,Devolução,Status\n';
    loans.forEach(loan => {
      const user = getUserById(loan.userId);
      const book = getBookById(loan.bookId);
      if (user && book) {
        const status = loan.status === 'active' ? 'Ativo' : 'Devolvido';
        csv += `"${user.name}","${book.title}","${formatDate(loan.loanDate)}","${formatDate(loan.dueDate)}","${status}"\n`;
      }
    });
    downloadCSV(csv, 'emprestimos.csv');
  }

  // ========== UI ==========
  function renderBooksGrid(selector) {
    const container = document.querySelector(selector);
    if (!container) return;

    const books = getBooks();
    container.innerHTML = books.map(book => {
      const available = getAvailableCopiesCount(book.id);
      const total = getTotalCopiesCount(book.id);
      return `
        <div class="card">
          <img src="${book.coverUrl}" class="card-img" alt="${book.title}" 
               onerror="this.src='${PLACEHOLDER}'">
          <div class="card-body">
            <h3 class="card-title">${book.title}</h3>
            <p class="card-subtitle">${book.author}</p>
            <div style="margin: 0.5rem 0;">
              <code style="background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">ID: ${book.id}</code>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
              <span class="badge ${available > 0 ? 'badge-success' : 'badge-danger'}">
                ${available}/${total} disponível
              </span>
              <a href="book.html?id=${book.id}" class="btn btn-primary btn-small">Ver Detalhes</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function viewDetails(bookId) {
    window.location.href = 'book.html?id=' + bookId;
  }

  function initApp() {
    initSystem();
    initTheme();
    checkAndCreateNotifications();
    
    const user = getCurrentUser();
    const navMenu = document.querySelector('.navbar-menu');
    
    if (navMenu) {
      const greeting = user 
        ? (user.role === 'librarian'
          ? `<a href="dashboard_bibliotecario.html" class="navbar-link" style="font-weight: 600;">Olá, ${user.name}</a>`
          : `<a href="dashboard_aluno.html" class="navbar-link" style="font-weight: 600;">Olá, ${user.name}</a>`)
        : '';
      
      // Badge de notificações não lidas
      let notifBadge = '';
      if (user && user.role === 'student') {
        const unreadCount = getUserNotifications(user.id, true).length;
        if (unreadCount > 0) {
          notifBadge = `<span style="background: #EF4444; color: white; border-radius: 50%; padding: 0.125rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem;">${unreadCount}</span>`;
        }
      }
      
      navMenu.innerHTML = `
        <a href="index.html" class="navbar-link">Início</a>
        <a href="books.html" class="navbar-link">Livros</a>
        ${greeting}${notifBadge}
        <button onclick="toggleTheme()" class="btn btn-secondary btn-small" style="margin-left: 0.5rem;" title="Alternar tema">
          🌓
        </button>
        ${user 
          ? '<a href="javascript:logout()" class="navbar-link">Sair</a>'
          : '<a href="login.html" class="btn btn-primary btn-small">Login</a>'
        }
      `;
    }

    if (document.querySelector('.home-books-container')) {
      renderBooksGrid('.home-books-container');
    }
    if (document.querySelector('.books-container')) {
      renderBooksGrid('.books-container');
    }
  }

  // ========== GLOBAL EXPORTS ==========
  window.User = User;
  window.Book = Book;
  window.Copy = Copy;
  window.Loan = Loan;
  window.Reservation = Reservation;
  window.Notification = Notification;
  window.registerUser = registerUser;
  window.login = login;
  window.logout = logout;
  window.initApp = initApp;
  window.getCurrentUser = getCurrentUser;
  window.setCurrentUser = setCurrentUser;
  window.updateUserProfile = updateUserProfile;
  window.getUsers = getUsers;
  window.saveUsers = saveUsers;
  window.getBooks = getBooks;
  window.saveBooks = saveBooks;
  window.getCopies = getCopies;
  window.saveCopies = saveCopies;
  window.getLoans = getLoans;
  window.saveLoans = saveLoans;
  window.getReservations = getReservations;
  window.saveReservations = saveReservations;
  window.getNotifications = getNotifications;
  window.getUserNotifications = getUserNotifications;
  window.markNotificationAsRead = markNotificationAsRead;
  window.markAllNotificationsAsRead = markAllNotificationsAsRead;
  window.createNotification = createNotification;
  window.getBookById = getBookById;
  window.getUserById = getUserById;
  window.getAvailableCopiesCount = getAvailableCopiesCount;
  window.getTotalCopiesCount = getTotalCopiesCount;
  window.searchBooks = searchBooks;
  window.debounceSearch = debounceSearch;
  window.borrowBook = borrowBook;
  window.returnBook = returnBook;
  window.renewLoan = renewLoan;
  window.reserveBook = reserveBook;
  window.cancelReservation = cancelReservation;
  window.checkFulfilledReservations = checkFulfilledReservations;
  window.checkUpcomingDueDates = checkUpcomingDueDates;
  window.formatDate = formatDate;
  window.getDaysUntilDue = getDaysUntilDue;
  window.getOverdueLoans = getOverdueLoans;
  window.getTopBorrowedBooks = getTopBorrowedBooks;
  window.exportTopBorrowedBooks = exportTopBorrowedBooks;
  window.exportOverdueLoans = exportOverdueLoans;
  window.exportAllLoans = exportAllLoans;
  window.findAvailableCopy = findAvailableCopy;
  window.updateCopyStatus = updateCopyStatus;
  window.getLoanPeriodDays = getLoanPeriodDays;
  window.renderBooksGrid = renderBooksGrid;
  window.viewDetails = viewDetails;
  window.toggleTheme = toggleTheme;
  window.getRecommendations = getRecommendations;
  window.DEFAULT_AVATAR = DEFAULT_AVATAR;

  console.log('📚 Sistema de Biblioteca carregado!');
})();