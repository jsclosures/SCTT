/**
 * Customer Record Management – front-end logic
 *
 * Handles:
 *   - Rendering the customer list (table view)
 *   - Rendering the customer detail (card view)
 *   - Create / edit / delete via modal forms
 *   - REST calls to /api/customers
 */
(function () {
    'use strict';

    /* ── DOM refs ───────────────────────────────────────────────────── */
    const viewList   = document.getElementById('view-list');
    const viewDetail = document.getElementById('view-detail');
    const tableBody  = document.getElementById('customer-tbody');
    const totalCount = document.getElementById('total-count');

    /* Detail fields */
    const detailAvatar  = document.getElementById('detail-avatar');
    const detailName    = document.getElementById('detail-name');
    const detailId      = document.getElementById('detail-id');
    const detailFName   = document.getElementById('detail-field-name');
    const detailFAddr   = document.getElementById('detail-field-address');
    const detailFPhone  = document.getElementById('detail-field-phone');
    const detailFCreate = document.getElementById('detail-field-created');
    const detailFUpdate = document.getElementById('detail-field-updated');

    /* Modal */
    const modalOverlay  = document.getElementById('modal-overlay');
    const modalTitle    = document.getElementById('modal-title');
    const formName      = document.getElementById('form-name');
    const formAddress   = document.getElementById('form-address');
    const formPhone     = document.getElementById('form-phone');
    const formNameError = document.getElementById('form-name-error');
    const formSaveBtn   = document.getElementById('form-save-btn');

    /* Toast */
    const toast = document.getElementById('crm-toast');

    /* State */
    let currentCustomerId = null;  // null = create mode, number = edit mode
    let currentDetailId   = null;  // the customer whose detail is shown

    /* ── Helpers ────────────────────────────────────────────────────── */
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function avatarInitials(name) {
        if (!name) return '?';
        let parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return (parts[0][0] + (parts[0][1] || parts[0][0])).toUpperCase();
    }

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        try {
            return new Date(isoStr).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return isoStr; }
    }

    function showToast(message, type) {
        toast.textContent = message;
        toast.className = 'crm-toast ' + (type || '');
        // force reflow to restart transition
        toast.classList.add('visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(function () {
            toast.classList.remove('visible');
        }, 3000);
    }

    function setFieldValue(el, value) {
        if (!el) return;
        if (value) {
            el.textContent = value;
            el.classList.remove('empty');
        } else {
            el.textContent = 'Not provided';
            el.classList.add('empty');
        }
    }

    /* ── API calls ──────────────────────────────────────────────────── */
    function apiRequest(method, path, body, callback) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, path);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            let data;
            try { data = JSON.parse(xhr.responseText); } catch (e) { data = {}; }
            callback(xhr.status, data);
        };
        xhr.send(body ? JSON.stringify(body) : null);
    }

    /* ── List view ──────────────────────────────────────────────────── */
    function loadCustomers() {
        tableBody.innerHTML = '<tr><td colspan="4" class="crm-spinner">Loading…</td></tr>';
        apiRequest('GET', '/api/customers', null, function (status, data) {
            renderCustomerList(data.customers || []);
        });
    }

    function renderCustomerList(customers) {
        if (totalCount) totalCount.textContent = customers.length;

        if (!customers.length) {
            tableBody.innerHTML =
                '<tr><td colspan="4"><div class="crm-empty">' +
                '<svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
                '<p>No customer records found.</p>' +
                '</div></td></tr>';
            return;
        }

        let html = '';
        customers.forEach(function (c) {
            html +=
                '<tr>' +
                '<td data-label="Name" class="customer-name-cell">' +
                  '<a class="customer-name-link" href="#" data-id="' + escapeHTML(String(c.id)) + '">' +
                    escapeHTML(c.name) +
                  '</a>' +
                '</td>' +
                '<td data-label="Address">' + escapeHTML(c.address || '—') + '</td>' +
                '<td data-label="Phone">'   + escapeHTML(c.phone   || '—') + '</td>' +
                '<td data-label="Actions" style="white-space:nowrap">' +
                  '<button class="btn btn-sm btn-secondary" data-action="edit"   data-id="' + c.id + '" style="margin-right:4px">Edit</button>' +
                  '<button class="btn btn-sm btn-danger"    data-action="delete" data-id="' + c.id + '">Delete</button>' +
                '</td>' +
                '</tr>';
        });
        tableBody.innerHTML = html;

        // Delegate click events
        tableBody.querySelectorAll('.customer-name-link').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                showDetail(parseInt(this.getAttribute('data-id'), 10));
            });
        });
        tableBody.querySelectorAll('[data-action="edit"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openEditModal(parseInt(this.getAttribute('data-id'), 10));
            });
        });
        tableBody.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                confirmDelete(parseInt(this.getAttribute('data-id'), 10));
            });
        });
    }

    /* ── Detail view ────────────────────────────────────────────────── */
    function showDetail(id) {
        apiRequest('GET', '/api/customers/' + id, null, function (status, data) {
            if (status !== 200 || !data.customer) {
                showToast('Could not load customer details.', 'error');
                return;
            }
            renderDetail(data.customer);
        });
    }

    function renderDetail(c) {
        currentDetailId = c.id;

        let initials = avatarInitials(c.name);
        if (detailAvatar) detailAvatar.textContent = initials;
        if (detailName)   detailName.textContent   = c.name || '';
        if (detailId)     detailId.textContent      = 'Customer #' + c.id;

        setFieldValue(detailFName,   c.name);
        setFieldValue(detailFAddr,   c.address);
        setFieldValue(detailFPhone,  c.phone);
        setFieldValue(detailFCreate, formatDate(c.created_at));
        setFieldValue(detailFUpdate, formatDate(c.updated_at));

        viewList.style.display   = 'none';
        viewDetail.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showList() {
        viewDetail.style.display = 'none';
        viewList.style.display   = 'block';
        currentDetailId = null;
        loadCustomers();
    }

    /* ── Create / Edit modal ────────────────────────────────────────── */
    function openCreateModal() {
        currentCustomerId = null;
        modalTitle.textContent = 'New Customer';
        formName.value    = '';
        formAddress.value = '';
        formPhone.value   = '';
        clearFormErrors();
        modalOverlay.classList.add('active');
        formName.focus();
    }

    function openEditModal(id) {
        apiRequest('GET', '/api/customers/' + id, null, function (status, data) {
            if (status !== 200 || !data.customer) {
                showToast('Could not load customer.', 'error');
                return;
            }
            let c = data.customer;
            currentCustomerId = c.id;
            modalTitle.textContent = 'Edit Customer';
            formName.value    = c.name    || '';
            formAddress.value = c.address || '';
            formPhone.value   = c.phone   || '';
            clearFormErrors();
            modalOverlay.classList.add('active');
            formName.focus();
        });
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        currentCustomerId = null;
    }

    function clearFormErrors() {
        formNameError.style.display = 'none';
        formName.style.borderColor  = '';
    }

    function saveCustomer() {
        clearFormErrors();

        let name    = formName.value.trim();
        let address = formAddress.value.trim();
        let phone   = formPhone.value.trim();

        if (!name) {
            formNameError.style.display = 'block';
            formName.style.borderColor  = '#DC3545';
            formName.focus();
            return;
        }

        formSaveBtn.disabled = true;
        formSaveBtn.textContent = 'Saving…';

        let body   = { name: name, address: address, phone: phone };
        let method = currentCustomerId ? 'PUT' : 'POST';
        let path   = currentCustomerId ? '/api/customers/' + currentCustomerId : '/api/customers';

        apiRequest(method, path, body, function (status, data) {
            formSaveBtn.disabled = false;
            formSaveBtn.textContent = 'Save';

            if ((status === 200 || status === 201) && data.status === 1) {
                closeModal();
                showToast(currentCustomerId ? 'Customer updated.' : 'Customer created.', 'success');
                if (viewDetail.style.display !== 'none' && currentDetailId) {
                    renderDetail(data.customer);
                } else {
                    loadCustomers();
                }
            } else {
                showToast((data && data.message) || 'Save failed.', 'error');
            }
        });
    }

    /* ── Delete ─────────────────────────────────────────────────────── */
    function confirmDelete(id) {
        if (!confirm('Delete this customer record? This cannot be undone.')) return;

        apiRequest('DELETE', '/api/customers/' + id, null, function (status, data) {
            if (status === 200 && data.status === 1) {
                showToast('Customer deleted.', 'success');
                if (viewDetail.style.display !== 'none') {
                    showList();
                } else {
                    loadCustomers();
                }
            } else {
                showToast((data && data.message) || 'Delete failed.', 'error');
            }
        });
    }

    /* ── Event wiring ───────────────────────────────────────────────── */
    document.getElementById('btn-new-customer').addEventListener('click', openCreateModal);
    document.getElementById('btn-back').addEventListener('click', showList);
    document.getElementById('btn-edit-detail').addEventListener('click', function () {
        if (currentDetailId) openEditModal(currentDetailId);
    });
    document.getElementById('btn-delete-detail').addEventListener('click', function () {
        if (currentDetailId) confirmDelete(currentDetailId);
    });
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    formSaveBtn.addEventListener('click', saveCustomer);

    /* Close modal on overlay click */
    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeModal();
    });

    /* Close modal on Escape */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
    });

    /* ── Init ───────────────────────────────────────────────────────── */
    loadCustomers();
}());
