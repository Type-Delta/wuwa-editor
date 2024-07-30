/**
 * Get the full image path of all running processes using QueryFullProcessImageName.
 * For Windows
 *
 * MAY REQUIRE ADMINISTRATOR PRIVILEGES for some processes.
*/


#include <Windows.h>
#include <Psapi.h>
#include <iostream>

#pragma comment(lib, "ntdll.lib")

typedef NTSTATUS(NTAPI *_NtQueryInformationProcess)(
   HANDLE ProcessHandle,
   ULONG ProcessInformationClass,
   PVOID ProcessInformation,
   ULONG ProcessInformationLength,
   PULONG ReturnLength
);

int main()
{
   // Get the function NtQueryInformationProcess from ntdll.dll
   HMODULE ntdll = GetModuleHandle("ntdll.dll");
   if (!ntdll)
   {
      std::cerr << "Failed to load ntdll.dll." << std::endl;
      return 1;
   }

   _NtQueryInformationProcess NtQueryInformationProcess =
       (_NtQueryInformationProcess)GetProcAddress(ntdll, "NtQueryInformationProcess");
   if (!NtQueryInformationProcess)
   {
      std::cerr << "Failed to get NtQueryInformationProcess function." << std::endl;
      return 1;
   }

   // Get the list of process IDs
   DWORD aProcesses[1024], cbNeeded, cProcesses;
   if (!EnumProcesses(aProcesses, sizeof(aProcesses), &cbNeeded))
   {
      std::cerr << "EnumProcesses failed." << std::endl;
      return 1;
   }

   cProcesses = cbNeeded / sizeof(DWORD);

   for (unsigned int i = 0; i < cProcesses; i++)
   {
      if (aProcesses[i] != 0)
      {
         HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, aProcesses[i]);
         if (hProcess)
         {
            // Try to get the full image path using QueryFullProcessImageName
            char imagePath[MAX_PATH];
            DWORD size = MAX_PATH;
            if (QueryFullProcessImageName(hProcess, 0, imagePath, &size))
            {
               wprintf(L"PID: %u, Path: %s\n", aProcesses[i], imagePath);
            }
            else
            {
               std::cerr << "QueryFullProcessImageName failed for process ID " << aProcesses[i] << std::endl;
            }
            CloseHandle(hProcess);
         }
         else
         {
            std::cerr << "OpenProcess failed for process ID " << aProcesses[i] << std::endl;
         }
      }
   }
   return 0;
}
