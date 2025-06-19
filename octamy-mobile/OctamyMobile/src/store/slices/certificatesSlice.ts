import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiService } from '../../services/api';
import { API_ENDPOINTS } from '../../constants/api';
import { Certificate } from '../../types';

interface CertificatesState {
  certificates: Certificate[];
  selectedCertificate: Certificate | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CertificatesState = {
  certificates: [],
  selectedCertificate: null,
  isLoading: false,
  error: null,
};

export const fetchUserCertificates = createAsyncThunk(
  'certificates/fetchUserCertificates',
  async () => {
    return await apiService.get<Certificate[]>(API_ENDPOINTS.USER_CERTIFICATES);
  }
);

export const fetchCertificateDetail = createAsyncThunk(
  'certificates/fetchCertificateDetail',
  async (certificateId: string) => {
    return await apiService.get<Certificate>(API_ENDPOINTS.CERTIFICATE_DETAIL(certificateId));
  }
);

export const fetchRecentCertificates = createAsyncThunk(
  'certificates/fetchRecentCertificates',
  async () => {
    return await apiService.get<Certificate[]>(API_ENDPOINTS.RECENT_CERTIFICATES);
  }
);

const certificatesSlice = createSlice({
  name: 'certificates',
  initialState,
  reducers: {
    clearSelectedCertificate: (state) => {
      state.selectedCertificate = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user certificates
      .addCase(fetchUserCertificates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserCertificates.fulfilled, (state, action) => {
        state.isLoading = false;
        state.certificates = action.payload;
      })
      .addCase(fetchUserCertificates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch certificates';
      })
      
      // Fetch certificate detail
      .addCase(fetchCertificateDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCertificateDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedCertificate = action.payload;
      })
      .addCase(fetchCertificateDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch certificate details';
      });
  },
});

export const { clearSelectedCertificate, clearError } = certificatesSlice.actions;
export default certificatesSlice.reducer;